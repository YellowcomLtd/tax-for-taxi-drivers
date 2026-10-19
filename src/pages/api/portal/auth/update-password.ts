import type { APIRoute } from 'astro';
import { createSupabaseAdmin, createSupabaseServer } from '../../../../lib/supabase/server';
import { error, json, portalIsLive } from '../../../../lib/portal/api';

export const prerender = false;

/** Complete password update after recovery / invite (recovery session required). */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!portalIsLive()) return error('Live portal is not configured', 503);

  const body = await request.json().catch(() => null);
  const password = String(body?.password || '');
  if (password.length < 10) {
    return error('Password must be at least 10 characters');
  }

  const supabase = createSupabaseServer({ request, cookies });
  const authHeader = request.headers.get('Authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

  let userId: string | null = null;

  if (bearer) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(bearer);
    if (userError || !user) return error('Reset session expired. Request a new invite link.', 401);
    userId = user.id;
  } else {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return error('Reset session expired. Request a new invite link.', 401);
    userId = user.id;
  }

  // Service-role update works whether the recovery JWT is in cookies or Authorization.
  const admin = createSupabaseAdmin();
  const { error: upError } = await admin.auth.admin.updateUserById(userId, { password });
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
