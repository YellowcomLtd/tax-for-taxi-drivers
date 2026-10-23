import type { APIRoute } from 'astro';
import { error, json, mapClientDocument, mapClientFile, mapProfile, mapSubmission, requireAdmin } from '../../../../lib/portal/api';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const id = context.params.id;
  if (!id) return error('User id required');

  const { admin } = auth;
  const { data: profile, error: pError } = await admin.from('profiles').select('*').eq('id', id).maybeSingle();
  if (pError) return error(pError.message, 500);
  if (!profile) return error('User not found', 404);

  const [{ data: submissions }, { data: documents }, filesResult] = await Promise.all([
    admin.from('submissions').select('*').eq('user_id', id).order('updated_at', { ascending: false }),
    admin.from('client_documents').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    admin.from('client_files').select('*').eq('user_id', id).order('created_at', { ascending: false }),
  ]);

  const files =
    filesResult.error && (filesResult.error.message?.includes('client_files') || filesResult.error.code === '42P01')
      ? []
      : (filesResult.data || []).map((row) => mapClientFile(row as Record<string, unknown>));

  return json({
    user: mapProfile(profile as Record<string, unknown>),
    submissions: (submissions || []).map((row) => mapSubmission(row as Record<string, unknown>)),
    documents: (documents || []).map((row) => mapClientDocument(row as Record<string, unknown>)),
    files,
  });
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const id = context.params.id;
  if (!id) return error('User id required');

  const body = await context.request.json().catch(() => null);
  if (!body) return error('Invalid body');

  const updates: Record<string, unknown> = {};
  const map: Record<string, string> = {
    fullName: 'full_name',
    phone: 'phone',
    companyName: 'company_name',
    addressLine1: 'address_line1',
    addressLine2: 'address_line2',
    addressLine3: 'address_line3',
    city: 'city',
    region: 'region',
    postalCode: 'postal_code',
    countryCode: 'country_code',
    utr: 'utr',
    agentReference: 'agent_reference',
    gocardlessCustomerId: 'gocardless_customer_id',
    notes: 'notes',
    tradeType: 'trade_type',
    active: 'active',
  };

  for (const [key, col] of Object.entries(map)) {
    if (body[key] !== undefined) {
      updates[col] = body[key] === '' ? null : body[key];
    }
  }

  if (Object.keys(updates).length === 0) return error('No updates provided');

  const { admin } = auth;
  const { data, error: upError } = await admin.from('profiles').update(updates).eq('id', id).select('*').single();
  if (upError) {
    if (upError.message?.includes('column') || upError.code === '42703') {
      return error(
        'Profile CRM columns missing. Run supabase/migrations/20261019160000_profile_crm_fields.sql in Supabase.',
        500
      );
    }
    return error(upError.message, 400);
  }

  if (updates.full_name || updates.trade_type !== undefined) {
    await admin.auth.admin.updateUserById(id, {
      user_metadata: { full_name: data.full_name },
      app_metadata: {
        role: data.role,
        ...(data.trade_type ? { trade_type: data.trade_type } : { trade_type: null }),
      },
    });
  }

  return json({ ok: true, user: mapProfile(data as Record<string, unknown>) });
};
