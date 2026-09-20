import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { getSupabaseAnonKey, getSupabaseUrl } from '../env';

export function createBrowserSupabase() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error('Supabase public env vars are not configured');
  }
  return createBrowserClient<Database>(url, key);
}
