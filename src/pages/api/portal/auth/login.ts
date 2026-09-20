import type { APIRoute } from 'astro';
import { createHash, randomInt } from 'node:crypto';
import { createSupabaseAdmin, createSupabaseServer } from '../../../../lib/supabase/server';
import { sendEmail, otpEmailContent } from '../../../../lib/mail/mailgun';
import { error, json, portalIsLive } from '../../../../lib/portal/api';

export const prerender = false;

function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    if (!portalIsLive()) return error('Live portal is not configured', 503);

    const body = await request.json().catch(() => null);
    const email = String(body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(body?.password || '');

    if (!email || !password) return error('Email and password are required');

    const supabase = createSupabaseServer(cookies);
    const { data, error: signError } = await supabase.auth.signInWithPassword({ email, password });

    if (signError || !data.user) {
      return error('Email or password not recognised', 401);
    }

    const admin = createSupabaseAdmin();
    const { data: profile } = await admin.from('profiles').select('*').eq('id', data.user.id).maybeSingle();

    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      cookies.delete('tft_mfa_ok', { path: '/' });
      cookies.delete('tft_login_challenge', { path: '/' });
      return error('This account is inactive. Contact the office.', 403);
    }

    const code = String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await admin.from('login_challenges').delete().eq('user_id', data.user.id).is('consumed_at', null);
    const { data: challenge, error: challengeError } = await admin
      .from('login_challenges')
      .insert({
        user_id: data.user.id,
        code_hash: hashCode(code),
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (challengeError || !challenge) {
      console.error('[login] challenge insert failed', challengeError);
      await supabase.auth.signOut();
      return error(
        challengeError?.message?.includes('login_challenges') || challengeError?.code === '42P01'
          ? 'Sign-in table missing. Run the login_challenges SQL migration in Supabase.'
          : 'Could not start sign-in challenge',
        500
      );
    }

    cookies.set('tft_login_challenge', challenge.id, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    // Session exists but portal APIs require tft_mfa_ok after OTP
    cookies.delete('tft_mfa_ok', { path: '/' });

    const mail = otpEmailContent({ fullName: profile.full_name, code });
    const sent = await sendEmail({ to: profile.email, ...mail });
    const { error: noticeError } = await admin.from('email_notices').insert({
      to_email: profile.email,
      subject: mail.subject,
      body: mail.text,
      kind: 'otp',
      created_by: profile.id,
      meta: { mailgunOk: sent.ok, mailgunError: sent.error || null },
    });
    if (noticeError) console.error('[login] email_notices insert failed', noticeError);

    if (!sent.ok) {
      // Still advance the client to the OTP step, but make the failure obvious.
      return json({
        ok: true,
        email: profile.email,
        fullName: profile.full_name,
        mailSent: false,
        mailError: sent.error || 'Could not send verification email',
      });
    }

    return json({
      ok: true,
      email: profile.email,
      fullName: profile.full_name,
      mailSent: true,
    });
  } catch (err) {
    console.error('[login] unhandled', err);
    const message = err instanceof Error ? err.message : 'Sign in failed';
    return error(message, 500);
  }
};
