import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../../../lib/supabase/server';
import { sendEmail, resetEmailContent } from '../../../../lib/mail/mailgun';
import { siteUrl } from '../../../../lib/env';
import { error, json, portalIsLive } from '../../../../lib/portal/api';

export const prerender = false;

/** Self-service password reset request — always returns a generic success. */
export const POST: APIRoute = async ({ request }) => {
  if (!portalIsLive()) return error('Live portal is not configured', 503);

  const body = await request.json().catch(() => null);
  const email = String(body?.email || '')
    .trim()
    .toLowerCase();
  if (!email) return error('Email is required');

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('*').eq('email', email).maybeSingle();

  if (profile?.active) {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${siteUrl()}/portal/reset-password`,
      },
    });

    if (!linkError && linkData?.properties?.action_link) {
      const mail = resetEmailContent({
        fullName: profile.full_name,
        resetUrl: linkData.properties.action_link,
      });
      await sendEmail({ to: email, ...mail });
      await admin.from('email_notices').insert({
        to_email: email,
        subject: mail.subject,
        body: mail.text,
        kind: 'password_reset',
        created_by: profile.id,
      });
    }
  }

  return json({
    ok: true,
    message: 'If that email is registered, a reset link has been sent.',
  });
};
