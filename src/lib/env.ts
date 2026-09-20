/** Runtime process.env first — Vite must not tree-shake Vercel serverless secrets. */
function readProcessEnv(name: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  // Dynamic key access avoids build-time inlining of secret names.
  const value = process.env[name];
  if (typeof value === 'string' && value.length > 0) return value;
  return undefined;
}

function readImportMetaEnv(name: string): string | undefined {
  try {
    const env = import.meta.env as Record<string, unknown>;
    const value = env[name];
    if (typeof value === 'string' && value.length > 0) return value;
  } catch {
    /* ignore */
  }
  return undefined;
}

function readEnv(name: string): string | undefined {
  return readProcessEnv(name) ?? readImportMetaEnv(name);
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
    readImportMetaEnv('SITE') ||
    'https://www.taxfortaxidrivers.co.uk'
  ).replace(/\/$/, '');
}

export function getMailgunConfig() {
  return {
    apiKey: readEnv('MAILGUN_API_KEY'),
    domain: readEnv('MAILGUN_DOMAIN'),
    from: readEnv('MAILGUN_FROM'),
    apiBase: readEnv('MAILGUN_API_BASE') || 'https://api.mailgun.net',
  };
}

/** Inbox for website contact-form enquiries (test inbox until go-live). */
export function contactEnquiryTo(): string {
  return readEnv('CONTACT_ENQUIRY_TO') || 'smcc239@gmail.com';
}
