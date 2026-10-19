import type { APIContext } from 'astro';
import { createSupabaseServer, createSupabaseAdmin } from '../supabase/server';
import type { AppRole } from '../supabase/database.types';
import { isLivePortal } from '../env';

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export function error(message: string, status = 400) {
  return json({ error: message }, status);
}

export function portalIsLive() {
  return isLivePortal();
}

export async function requireUser(context: APIContext) {
  if (!portalIsLive()) {
    return { error: error('Portal is not configured', 503) as Response };
  }

  const mfaOk = context.cookies.get('tft_mfa_ok')?.value === '1';
  if (!mfaOk) {
    return { error: error('Complete sign-in verification first', 401) as Response };
  }

  const supabase = createSupabaseServer({ request: context.request, cookies: context.cookies });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: error('Unauthorised', 401) as Response };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.active) {
    return { error: error('Account not found or inactive', 403) as Response };
  }

  return { supabase, user, profile, admin: createSupabaseAdmin() };
}

export async function requireAdmin(context: APIContext) {
  const result = await requireUser(context);
  if ('error' in result && result.error instanceof Response) return result;
  if (!('profile' in result) || result.profile.role !== 'admin') {
    return { error: error('Admin access required', 403) as Response };
  }
  return result;
}

export function roleFromProfile(role: string): AppRole {
  return role === 'admin' ? 'admin' : 'client';
}

export function mapProfile(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    email: row.email as string,
    fullName: row.full_name as string,
    role: roleFromProfile(String(row.role || 'client')),
    tradeType: (row.trade_type as 'taxi' | 'beautician' | null) || undefined,
    active: row.active !== false,
    password: '',
    phone: (row.phone as string) || undefined,
    companyName: (row.company_name as string) || undefined,
    addressLine1: (row.address_line1 as string) || undefined,
    addressLine2: (row.address_line2 as string) || undefined,
    addressLine3: (row.address_line3 as string) || undefined,
    city: (row.city as string) || undefined,
    region: (row.region as string) || undefined,
    postalCode: (row.postal_code as string) || undefined,
    countryCode: (row.country_code as string) || undefined,
    utr: (row.utr as string) || undefined,
    agentReference: (row.agent_reference as string) || undefined,
    gocardlessCustomerId: (row.gocardless_customer_id as string) || undefined,
    notes: (row.notes as string) || undefined,
    createdAt: (row.created_at as string) || undefined,
    updatedAt: (row.updated_at as string) || undefined,
  };
}

export function mapSubmission(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    periodLabel: row.period_label as string,
    tradeType: row.trade_type as 'taxi' | 'beautician',
    status: row.status as string,
    months: row.months ?? [],
    income: row.income ?? {},
    lines: row.lines ?? [],
    files: row.files ?? [],
    signDocument: row.sign_document ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    signedAt: (row.signed_at as string) || undefined,
    clientSignature: row.client_signature ?? undefined,
    adminSignature: row.admin_signature ?? undefined,
    signedDocumentHtml: (row.signed_document_html as string) || undefined,
  };
}

export function submissionToRow(sub: Record<string, unknown>) {
  return {
    user_id: sub.userId,
    period_label: sub.periodLabel,
    trade_type: sub.tradeType,
    status: sub.status,
    months: sub.months ?? [],
    income: sub.income ?? {},
    lines: sub.lines ?? [],
    files: sub.files ?? [],
    sign_document: sub.signDocument ?? null,
    client_signature: sub.clientSignature ?? null,
    admin_signature: sub.adminSignature ?? null,
    signed_document_html: sub.signedDocumentHtml ?? null,
    signed_at: sub.signedAt ?? null,
  };
}

export function mapClientDocument(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    docType: row.doc_type as 'letter_of_engagement' | 'contract_tax_returns',
    title: row.title as string,
    bodyHtml: row.body_html as string,
    status: row.status as 'sent' | 'signed',
    feeAmount: (row.fee_amount as string) || undefined,
    clientSignature: row.client_signature ?? undefined,
    signedDocumentHtml: (row.signed_document_html as string) || undefined,
    signedAt: (row.signed_at as string) || undefined,
    sentAt: row.sent_at as string,
    sentBy: (row.sent_by as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
