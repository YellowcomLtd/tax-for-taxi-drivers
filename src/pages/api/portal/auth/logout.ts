import type { APIRoute } from 'astro';
import { createSupabaseServer } from '../../../../lib/supabase/server';
import { json, portalIsLive } from '../../../../lib/portal/api';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  if (portalIsLive()) {
    const supabase = createSupabaseServer(cookies);
    await supabase.auth.signOut();
  }
  cookies.delete('tft_mfa_ok', { path: '/' });
  cookies.delete('tft_login_challenge', { path: '/' });
  return json({ ok: true });
};
