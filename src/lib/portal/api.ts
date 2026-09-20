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

  const supabase = createSupabaseServer(context.cookies);
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

export function mapProfile(row: {
  id: string;
  email: string;
  full_name: string;
  role: string;
  trade_type: string | null;
  active?: boolean;
}) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: roleFromProfile(row.role),
    tradeType: (row.trade_type as 'taxi' | 'beautician' | null) || undefined,
    active: row.active !== false,
    password: '',
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
