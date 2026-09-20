import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

export function createBrowserSupabase() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.PUBLIC_SUPABASE_URL : undefined);
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env.PUBLIC_SUPABASE_ANON_KEY : undefined);
  if (!url || !key) {
    throw new Error('Supabase public env vars are not configured');
  }
  return createBrowserClient<Database>(url, key);
}
