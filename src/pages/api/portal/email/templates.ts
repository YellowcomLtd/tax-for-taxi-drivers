import type { APIRoute } from 'astro';
import { error, json, requireAdmin } from '../../../../lib/portal/api';

export const prerender = false;

function mapTemplate(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    subject: String(row.subject || ''),
    body: String(row.body || ''),
    createdBy: row.created_by ? String(row.created_by) : undefined,
    updatedBy: row.updated_by ? String(row.updated_by) : undefined,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

function missingTable(err: { message?: string; code?: string } | null | undefined) {
  if (!err) return false;
  return Boolean(err.message?.includes('email_templates') || err.code === '42P01');
}

export const GET: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const { supabase } = auth;
  const { data, error: qError } = await supabase
    .from('email_templates')
    .select('*')
    .order('updated_at', { ascending: false });

  if (qError) {
    if (missingTable(qError)) return json({ templates: [] });
    return error(qError.message, 500);
  }

  return json({ templates: (data || []).map((row) => mapTemplate(row as Record<string, unknown>)) });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const body = await context.request.json().catch(() => null);
  const name = String(body?.name || '').trim();
  const subject = String(body?.subject || '').trim();
  const text = String(body?.body || '').trim();
  if (!name || !subject || !text) return error('Name, subject and message are required');

  const { supabase, profile } = auth;
  const { data, error: insertError } = await supabase
    .from('email_templates')
    .insert({
      name,
      subject,
      body: text,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select('*')
    .single();

  if (insertError) {
    if (missingTable(insertError)) {
      return error('Email templates table is not set up yet. Run the latest Supabase migration.', 503);
    }
    return error(insertError.message, 500);
  }

  return json({ ok: true, template: mapTemplate(data as Record<string, unknown>) });
};

export const PUT: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const body = await context.request.json().catch(() => null);
  const id = String(body?.id || '').trim();
  const name = String(body?.name || '').trim();
  const subject = String(body?.subject || '').trim();
  const text = String(body?.body || '').trim();
  if (!id) return error('Template id is required');
  if (!name || !subject || !text) return error('Name, subject and message are required');

  const { supabase, profile } = auth;
  const { data, error: updateError } = await supabase
    .from('email_templates')
    .update({
      name,
      subject,
      body: text,
      updated_by: profile.id,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    if (missingTable(updateError)) {
      return error('Email templates table is not set up yet. Run the latest Supabase migration.', 503);
    }
    return error(updateError.message, 500);
  }

  return json({ ok: true, template: mapTemplate(data as Record<string, unknown>) });
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const url = new URL(context.request.url);
  const id = String(url.searchParams.get('id') || '').trim();
  if (!id) return error('Template id is required');

  const { supabase } = auth;
  const { error: deleteError } = await supabase.from('email_templates').delete().eq('id', id);
  if (deleteError) {
    if (missingTable(deleteError)) {
      return error('Email templates table is not set up yet. Run the latest Supabase migration.', 503);
    }
    return error(deleteError.message, 500);
  }

  return json({ ok: true });
};
