import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { createSupabaseAdmin, createSupabaseServer } from '../../../../lib/supabase/server';
import { error, json, mapProfile, portalIsLive } from '../../../../lib/portal/api';

export const prerender = false;

function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!portalIsLive()) return error('Live portal is not configured', 503);

  const body = await request.json().catch(() => null);
  const code = String(body?.code || '').trim();
  const challengeId = cookies.get('tft_login_challenge')?.value;

  if (!challengeId || !/^\d{6}$/.test(code)) {
    return error('Invalid or expired code', 400);
  }

  const supabase = createSupabaseServer(cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return error('Sign in again', 401);

  const admin = createSupabaseAdmin();
  const { data: challenge } = await admin
    .from('login_challenges')
    .select('*')
    .eq('id', challengeId)
    .eq('user_id', user.id)
    .is('consumed_at', null)
    .maybeSingle();

  if (!challenge || new Date(challenge.expires_at).getTime() < Date.now()) {
    return error('Code expired. Sign in again.', 401);
  }

  if (challenge.code_hash !== hashCode(code)) {
    return error('That code is incorrect', 401);
  }

  await admin
    .from('login_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', challenge.id);

  cookies.delete('tft_login_challenge', { path: '/' });
  cookies.set('tft_mfa_ok', '1', {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });

  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) return error('Profile missing', 500);

  return json({
    ok: true,
    session: {
      userId: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
      tradeType: profile.trade_type || undefined,
    },
    profile: mapProfile(profile),
  });
};
