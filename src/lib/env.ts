function readEnv(name: string): string | undefined {
  const fromImport = import.meta.env[name];
  if (typeof fromImport === 'string' && fromImport.length > 0) return fromImport;
  if (typeof process !== 'undefined') {
    const fromProcess = process.env[name];
    if (typeof fromProcess === 'string' && fromProcess.length > 0) return fromProcess;
  }
  return undefined;
}

export function isLivePortal(): boolean {
  return Boolean(readEnv('PUBLIC_SUPABASE_URL') && readEnv('PUBLIC_SUPABASE_ANON_KEY'));
}

export function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function siteUrl(): string {
  return (
    readEnv('PUBLIC_SITE_URL') ||
    import.meta.env.SITE ||
    'https://www.taxfortaxidrivers.co.uk'
  ).replace(/\/$/, '');
}
