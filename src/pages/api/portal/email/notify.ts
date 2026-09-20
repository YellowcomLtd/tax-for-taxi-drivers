import type { APIRoute } from 'astro';
import { sendEmail } from '../../../../lib/mail/mailgun';
import { siteUrl } from '../../../../lib/env';
import { error, json, requireAdmin } from '../../../../lib/portal/api';

export const prerender = false;

/** Notify a client that a submission is ready to sign. */
export const POST: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const body = await context.request.json().catch(() => null);
  const submissionId = String(body?.submissionId || '');
  if (!submissionId) return error('submissionId is required');

  const { supabase, admin, profile } = auth;
  const { data: sub } = await supabase.from('submissions').select('*').eq('id', submissionId).maybeSingle();
  if (!sub) return error('Submission not found', 404);

  const { data: client } = await supabase.from('profiles').select('*').eq('id', sub.user_id).maybeSingle();
  if (!client) return error('Client not found', 404);

  const subject = 'Your declaration is ready to sign';
  const text = [
    `Hi ${client.full_name},`,
    '',
    `Your ${sub.period_label} submission is ready to sign.`,
    `Open the portal: ${siteUrl()}/portal/client`,
    '',
    'Tax for Taxi Drivers',
  ].join('\n');

  const sent = await sendEmail({ to: client.email, subject, text });
  await admin.from('email_notices').insert({
    to_email: client.email,
    subject,
    body: text,
    kind: 'ready_to_sign',
    created_by: profile.id,
    meta: { submissionId, mailgunOk: sent.ok },
  });

  return json({ ok: true, mailSent: sent.ok });
};
