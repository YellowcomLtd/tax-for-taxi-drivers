import type { APIRoute } from 'astro';
import { sendEmail } from '../../../../lib/mail/mailgun';
import { error, json, requireAdmin } from '../../../../lib/portal/api';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const { supabase } = auth;
  const { data, error: qError } = await supabase
    .from('email_campaigns')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(50);
  if (qError) return error(qError.message, 500);

  return json({
    campaigns: (data || []).map((c) => ({
      id: c.id,
      subject: c.subject,
      body: c.body,
      sentBy: c.sent_by,
      sentAt: c.sent_at,
      recipientCount: c.recipient_count,
      recipients: c.recipients,
    })),
  });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const body = await context.request.json().catch(() => null);
  const subject = String(body?.subject || '').trim();
  const text = String(body?.body || '').trim();
  if (!subject || !text) return error('Subject and message are required');

  const { supabase, profile, admin } = auth;
  const { data: clients } = await supabase
    .from('profiles')
    .select('email, full_name, active')
    .eq('role', 'client')
    .eq('active', true);

  const recipients = (clients || []).map((c) => c.email).filter(Boolean);
  if (recipients.length === 0) return error('No active clients to email', 400);

  let sentCount = 0;
  for (const to of recipients) {
    const result = await sendEmail({ to, subject, text });
    if (result.ok) sentCount += 1;
    await admin.from('email_notices').insert({
      to_email: to,
      subject,
      body: text,
      kind: 'bulk',
      created_by: profile.id,
      meta: { mailgunOk: result.ok },
    });
  }

  const { data: campaign, error: campError } = await supabase
    .from('email_campaigns')
    .insert({
      subject,
      body: text,
      sent_by: profile.id,
      recipient_count: recipients.length,
      recipients,
    })
    .select('*')
    .single();

  if (campError) return error(campError.message, 500);

  return json({
    ok: true,
    sentCount,
    recipientCount: recipients.length,
    campaign: {
      id: campaign.id,
      subject: campaign.subject,
      body: campaign.body,
      sentBy: campaign.sent_by,
      sentAt: campaign.sent_at,
      recipientCount: campaign.recipient_count,
      recipients: campaign.recipients,
    },
  });
};
