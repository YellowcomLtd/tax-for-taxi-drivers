import type { APIRoute } from 'astro';
import { createSupabaseServer } from '../../../../lib/supabase/server';
import { error, json, portalIsLive } from '../../../../lib/portal/api';

export const prerender = false;

/** Complete password update after recovery redirect (user must have a recovery session). */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!portalIsLive()) return error('Live portal is not configured', 503);

  const body = await request.json().catch(() => null);
  const password = String(body?.password || '');
  if (password.length < 10) {
    return error('Password must be at least 10 characters');
  }

  const supabase = createSupabaseServer(cookies);
  const { error: upError } = await supabase.auth.updateUser({ password });
  if (upError) return error(upError.message, 400);

  cookies.set('tft_mfa_ok', '1', {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });

  return json({ ok: true });
};
