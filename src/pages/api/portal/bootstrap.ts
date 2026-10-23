import type { APIRoute } from 'astro';
import { error, json, mapClientDocument, mapClientFile, mapProfile, mapSubmission, requireUser } from '../../../lib/portal/api';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireUser(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const { supabase, profile } = auth;

  const [{ data: profiles }, { data: submissions }, { data: campaigns }, docsResult, filesResult] = await Promise.all([
    profile.role === 'admin'
      ? supabase.from('profiles').select('*').order('full_name')
      : supabase.from('profiles').select('*').eq('id', profile.id),
    profile.role === 'admin'
      ? supabase.from('submissions').select('*').order('updated_at', { ascending: false })
      : supabase.from('submissions').select('*').eq('user_id', profile.id).order('updated_at', { ascending: false }),
    profile.role === 'admin'
      ? supabase.from('email_campaigns').select('*').order('sent_at', { ascending: false }).limit(50)
      : Promise.resolve({ data: [] as unknown[] }),
    profile.role === 'admin'
      ? supabase.from('client_documents').select('*').order('created_at', { ascending: false })
      : supabase.from('client_documents').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
    profile.role === 'admin'
      ? supabase.from('client_files').select('*').order('created_at', { ascending: false })
      : supabase.from('client_files').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
  ]);

  let documents: ReturnType<typeof mapClientDocument>[] = [];
  if (docsResult.error) {
    if (!(docsResult.error.message?.includes('client_documents') || docsResult.error.code === '42P01')) {
      console.error('[bootstrap] documents', docsResult.error);
    }
  } else {
    documents = (docsResult.data || []).map((row) => mapClientDocument(row as Record<string, unknown>));
  }

  let files: ReturnType<typeof mapClientFile>[] = [];
  if (filesResult.error) {
    if (!(filesResult.error.message?.includes('client_files') || filesResult.error.code === '42P01')) {
      console.error('[bootstrap] files', filesResult.error);
    }
  } else {
    files = (filesResult.data || []).map((row) => mapClientFile(row as Record<string, unknown>));
  }

  return json({
    session: {
      userId: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
      tradeType: profile.trade_type || undefined,
    },
    users: (profiles || []).map(mapProfile),
    submissions: (submissions || []).map((row) => mapSubmission(row as Record<string, unknown>)),
    campaigns: (campaigns || []).map((c) => ({
      id: (c as { id: string }).id,
      subject: (c as { subject: string }).subject,
      body: (c as { body: string }).body,
      sentBy: (c as { sent_by: string }).sent_by,
      sentAt: (c as { sent_at: string }).sent_at,
      recipientCount: (c as { recipient_count: number }).recipient_count,
      recipients: (c as { recipients: string[] }).recipients,
    })),
    documents,
    files,
  });
};

export const POST: APIRoute = async () => error('Method not allowed', 405);
