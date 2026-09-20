export function isLivePortal(): boolean {
  return Boolean(import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.PUBLIC_SUPABASE_ANON_KEY);
}

export function requireEnv(name: string): string {
  const value = import.meta.env[name] ?? (typeof process !== 'undefined' ? process.env[name] : undefined);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function siteUrl(): string {
  return (
    import.meta.env.PUBLIC_SITE_URL ||
    (typeof process !== 'undefined' ? process.env.PUBLIC_SITE_URL : undefined) ||
    import.meta.env.SITE ||
    'https://www.taxfortaxidrivers.co.uk'
  ).replace(/\/$/, '');
}
