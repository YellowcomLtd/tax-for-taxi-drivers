import type { APIRoute } from 'astro';
import { error, json, mapClientFile, requireAdmin, requireUser } from '../../../lib/portal/api';

export const prerender = false;

const MAX_BYTES = 2 * 1024 * 1024;

function missingTable(message?: string, code?: string) {
  return Boolean(message?.includes('client_files') || code === '42P01');
}

export const GET: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const url = new URL(context.request.url);
  const userId = url.searchParams.get('userId') || '';
  const { supabase, profile } = auth;

  let query = supabase.from('client_files').select('*').order('created_at', { ascending: false });
  if (profile.role === 'admin' && userId) {
    query = query.eq('user_id', userId);
  } else if (profile.role !== 'admin') {
    query = query.eq('user_id', profile.id);
  }

  const { data, error: qError } = await query;
  if (qError) {
    if (missingTable(qError.message, qError.code)) return json({ files: [] });
    return error(qError.message, 500);
  }
  return json({ files: (data || []).map((row) => mapClientFile(row as Record<string, unknown>)) });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const body = await context.request.json().catch(() => null);
  const userId = String(body?.userId || '');
  const name = String(body?.name || '').trim();
  const dataUrl = String(body?.dataUrl || '');
  const mimeType = String(body?.mimeType || 'application/octet-stream');
  const sizeLabel = String(body?.sizeLabel || '');
  const note = String(body?.note || '').trim();

  if (!userId) return error('userId is required');
  if (!name) return error('File name is required');
  if (!dataUrl.startsWith('data:')) return error('File data is required');
  if (dataUrl.length > MAX_BYTES * 1.4) return error('Keep each file under 2 MB');

  const { admin, profile } = auth;
  const { data: client } = await admin.from('profiles').select('id, role').eq('id', userId).maybeSingle();
  if (!client) return error('Client not found', 404);

  const { data, error: insError } = await admin
    .from('client_files')
    .insert({
      user_id: client.id,
      name,
      mime_type: mimeType,
      size_label: sizeLabel,
      note: note || null,
      data_url: dataUrl,
      uploaded_by: profile.id,
    })
    .select('*')
    .single();

  if (insError || !data) {
    return error(
      missingTable(insError?.message, insError?.code)
        ? 'Files table missing. Run supabase/migrations/20261023120000_client_files.sql in Supabase.'
        : insError?.message || 'Could not save file',
      500
    );
  }

  return json({ ok: true, file: mapClientFile(data as Record<string, unknown>) }, 201);
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const body = await context.request.json().catch(() => null);
  const id = String(body?.id || '');
  if (!id) return error('File id is required');

  const { admin } = auth;
  const { error: delError } = await admin.from('client_files').delete().eq('id', id);
  if (delError) {
    if (missingTable(delError.message, delError.code)) {
      return error('Files table missing. Run supabase/migrations/20261023120000_client_files.sql in Supabase.', 500);
    }
    return error(delError.message, 400);
  }
  return json({ ok: true });
};
