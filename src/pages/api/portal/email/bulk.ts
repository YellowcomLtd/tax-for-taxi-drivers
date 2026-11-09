import type { APIRoute } from 'astro';
import { bulkEmailContent, sendEmail } from '../../../../lib/mail/mailgun';
import { applyPersonalization, firstNameFrom } from '../../../../lib/mail/personalize';
import { portalPublicUrl } from '../../../../lib/portal/authLinks';
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

  const recipientIds = Array.isArray(body?.recipientIds)
    ? body.recipientIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
    : [];
  const recipientEmails = Array.isArray(body?.recipientEmails)
    ? body.recipientEmails
        .map((email: unknown) => String(email || '').trim().toLowerCase())
        .filter(Boolean)
    : [];

  const { supabase, profile, admin } = auth;

  let query = supabase
    .from('profiles')
    .select('id, email, full_name, role, active, company_name, phone')
    .eq('active', true);

  if (recipientIds.length) {
    query = query.in('id', recipientIds);
  } else if (recipientEmails.length) {
    query = query.in('email', recipientEmails);
  } else {
    // Legacy / fallback: all active clients
    query = query.eq('role', 'client');
  }

  const { data: people, error: listError } = await query;
  if (listError) return error(listError.message, 500);

  const recipients = (people || []).filter((c) => Boolean(c.email));
  if (recipients.length === 0) return error('No matching recipients to email', 400);

  const portalUrl = `${portalPublicUrl()}/portal`;
  let sentCount = 0;
  for (const person of recipients) {
    const fields = {
      fullName: person.full_name || undefined,
      email: person.email || undefined,
      companyName: person.company_name || undefined,
      phone: person.phone || undefined,
      portalUrl,
    };
    const mail = bulkEmailContent({
      subject: applyPersonalization(subject, fields),
      body: applyPersonalization(text, fields),
      fullName: person.full_name || undefined,
      firstName: firstNameFrom(person.full_name) || undefined,
    });
    const result = await sendEmail({ to: person.email, ...mail });
    if (result.ok) sentCount += 1;
    await admin.from('email_notices').insert({
      to_email: person.email,
      subject: mail.subject,
      body: mail.text,
      kind: 'bulk',
      created_by: profile.id,
      meta: { mailgunOk: result.ok, role: person.role, personalized: true },
    });
  }

  const { data: campaign, error: campError } = await supabase
    .from('email_campaigns')
    .insert({
      subject,
      body: text,
      sent_by: profile.id,
      recipient_count: recipients.length,
      recipients: recipients.map((c) => c.email),
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
