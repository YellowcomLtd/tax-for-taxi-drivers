import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';
import type { Database } from './database.types';
import { requireEnv } from '../env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

function sanitizeCookieOptions(options?: CookieOptions): Record<string, unknown> {
  if (!options) return {};
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) clean[key] = value;
  }
  return clean;
}

export function createSupabaseServer(cookies: AstroCookies) {
  const url = requireEnv('PUBLIC_SUPABASE_URL');
  const key = requireEnv('PUBLIC_SUPABASE_ANON_KEY');

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value, options } of cookiesToSet) {
          try {
            cookies.set(name, value, sanitizeCookieOptions(options));
          } catch (err) {
            console.error('[supabase] Failed to set cookie', name, err);
          }
        }
      },
    },
  });
}

/** Service-role client — server only. Bypasses RLS; use for admin invite/reset only. */
export function createSupabaseAdmin() {
  const url = requireEnv('PUBLIC_SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
