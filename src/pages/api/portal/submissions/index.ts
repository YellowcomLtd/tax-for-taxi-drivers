import type { APIRoute } from 'astro';
import { error, json, mapSubmission, requireUser, submissionToRow } from '../../../../lib/portal/api';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const { supabase, profile } = auth;
  const id = context.url.searchParams.get('id');

  let query = supabase.from('submissions').select('*');
  if (profile.role !== 'admin') query = query.eq('user_id', profile.id);
  if (id) query = query.eq('id', id);

  const { data, error: qError } = await query.order('updated_at', { ascending: false });
  if (qError) return error(qError.message, 500);

  const rows = (data || []).map((row) => mapSubmission(row as Record<string, unknown>));
  return json(id ? { submission: rows[0] || null } : { submissions: rows });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const body = await context.request.json().catch(() => null);
  if (!body) return error('Invalid body');

  const { supabase, profile } = auth;
  const userId = profile.role === 'admin' && body.userId ? String(body.userId) : profile.id;

  const row = submissionToRow({
    ...body,
    userId,
    status: body.status || 'draft',
  });

  const { data, error: insError } = await supabase.from('submissions').insert(row).select('*').single();
  if (insError) return error(insError.message, 400);
  return json({ submission: mapSubmission(data as Record<string, unknown>) }, 201);
};

export const PUT: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const body = await context.request.json().catch(() => null);
  const id = String(body?.id || '');
  if (!id) return error('Submission id is required');

  const { supabase, profile } = auth;
  const { data: existing } = await supabase.from('submissions').select('*').eq('id', id).maybeSingle();
  if (!existing) return error('Not found', 404);
  if (profile.role !== 'admin' && existing.user_id !== profile.id) return error('Forbidden', 403);
  if (existing.status === 'signed' && profile.role !== 'admin') {
    return error('Signed submissions cannot be edited', 400);
  }

  const row = submissionToRow({ ...mapSubmission(existing as Record<string, unknown>), ...body, id });
  delete (row as { user_id?: string }).user_id;

  const { data, error: upError } = await supabase.from('submissions').update(row).eq('id', id).select('*').single();
  if (upError) return error(upError.message, 400);
  return json({ submission: mapSubmission(data as Record<string, unknown>) });
};
