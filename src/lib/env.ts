function readEnv(name: string): string | undefined {
  const fromImport = import.meta.env[name];
  if (typeof fromImport === 'string' && fromImport.length > 0) return fromImport;
  if (typeof process !== 'undefined') {
    const fromProcess = process.env[name];
    if (typeof fromProcess === 'string' && fromProcess.length > 0) return fromProcess;
  }
  return undefined;
}

/** Prefer project names; fall back to common Supabase/Vercel integration aliases. */
function readEnvAlias(...names: string[]): string | undefined {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  return undefined;
}

export function isLivePortal(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export function getSupabaseUrl(): string | undefined {
  return readEnvAlias('PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
}

export function getSupabaseAnonKey(): string | undefined {
  return readEnvAlias(
    'PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY'
  );
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return readEnvAlias('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');
}

export function requireEnv(name: string): string {
  // Map canonical names to aliases used by the Vercel Supabase integration
  if (name === 'PUBLIC_SUPABASE_URL') {
    const value = getSupabaseUrl();
    if (value) return value;
  }
  if (name === 'PUBLIC_SUPABASE_ANON_KEY') {
    const value = getSupabaseAnonKey();
    if (value) return value;
  }
  if (name === 'SUPABASE_SERVICE_ROLE_KEY') {
    const value = getSupabaseServiceRoleKey();
    if (value) return value;
  }

  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function siteUrl(): string {
  return (
    readEnvAlias('PUBLIC_SITE_URL', 'SITE_URL', 'VERCEL_PROJECT_PRODUCTION_URL') ||
    import.meta.env.SITE ||
    'https://www.taxfortaxidrivers.co.uk'
  ).replace(/\/$/, '');
}
