import type { APIRoute } from 'astro';
import {
  error,
  json,
  mapClientDocument,
  requireAdmin,
  requireUser,
} from '../../../../lib/portal/api';
import { onboardingPackEmailContent, sendEmail } from '../../../../lib/mail/mailgun';
import {
  buildOnboardingBody,
  buildSignedOnboardingHtml,
  onboardingDocTitle,
  type OnboardingDocType,
} from '../../../../portal/lib/onboardingDocs';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const { supabase, profile } = auth;
  let query = supabase.from('client_documents').select('*').order('created_at', { ascending: false });
  if (profile.role !== 'admin') query = query.eq('user_id', profile.id);

  const { data, error: qError } = await query;
  if (qError) {
    if (qError.message?.includes('client_documents') || qError.code === '42P01') {
      return json({ documents: [] });
    }
    return error(qError.message, 500);
  }
  return json({ documents: (data || []).map((row) => mapClientDocument(row as Record<string, unknown>)) });
};

/** Admin: create Letter of Engagement + Contract pack for a client and email them. */
export const POST: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const body = await context.request.json().catch(() => null);
  const userId = String(body?.userId || '');
  const feeAmount = body?.feeAmount != null ? String(body.feeAmount).trim() : '';
  if (!userId) return error('userId is required');

  const { admin, profile: actor } = auth;
  const { data: client } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (!client || client.role !== 'client') return error('Client not found', 404);

  const types: OnboardingDocType[] = ['letter_of_engagement', 'contract_tax_returns'];
  const created = [];

  for (const docType of types) {
    const title = onboardingDocTitle(docType);
    const bodyHtml = buildOnboardingBody(docType, client.full_name, feeAmount || undefined);
    const { data: row, error: insError } = await admin
      .from('client_documents')
      .insert({
        user_id: client.id,
        doc_type: docType,
        title,
        body_html: bodyHtml,
        status: 'sent',
        fee_amount: docType === 'contract_tax_returns' ? feeAmount || null : null,
        sent_by: actor.id,
        sent_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (insError || !row) {
      return error(
        insError?.message?.includes('client_documents') || insError?.code === '42P01'
          ? 'Documents table missing. Run the client_documents SQL migration in Supabase.'
          : insError?.message || 'Could not create documents',
        500
      );
    }
    created.push(mapClientDocument(row as Record<string, unknown>));
  }

  const mail = onboardingPackEmailContent({ fullName: client.full_name });
  const sent = await sendEmail({ to: client.email, ...mail });
  await admin.from('email_notices').insert({
    to_email: client.email,
    subject: mail.subject,
    body: mail.text,
    kind: 'onboarding_pack',
    created_by: actor.id,
    meta: { mailgunOk: sent.ok, documentIds: created.map((d) => d.id) },
  });

  return json({ ok: true, documents: created, mailSent: sent.ok }, 201);
};

/** Client (or admin): sign a document. */
export const PUT: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const body = await context.request.json().catch(() => null);
  const id = String(body?.id || '');
  if (!id) return error('Document id is required');
  if (!body?.clientSignature) return error('Signature is required');

  const { supabase, profile, admin } = auth;
  const { data: existing } = await supabase.from('client_documents').select('*').eq('id', id).maybeSingle();
  if (!existing) return error('Not found', 404);
  if (profile.role !== 'admin' && existing.user_id !== profile.id) return error('Forbidden', 403);
  if (existing.status === 'signed') return error('Already signed', 400);

  const { data: client } = await admin.from('profiles').select('*').eq('id', existing.user_id).single();
  if (!client) return error('Client profile missing', 500);

  const signedAt = new Date().toISOString();
  const sig = body.clientSignature as Record<string, unknown>;
  const documentHash = String(sig.documentHash || '');
  const html = buildSignedOnboardingHtml({
    title: existing.title,
    bodyHtml: existing.body_html,
    clientName: client.full_name,
    clientEmail: client.email,
    signatureDataUrl: String(sig.signatureImageDataUrl || ''),
    signedAt,
    documentHash,
  });

  const { data: updated, error: upError } = await admin
    .from('client_documents')
    .update({
      status: 'signed',
      client_signature: sig,
      signed_document_html: html,
      signed_at: signedAt,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (upError || !updated) return error(upError?.message || 'Could not save signature', 400);
  return json({ document: mapClientDocument(updated as Record<string, unknown>) });
};
