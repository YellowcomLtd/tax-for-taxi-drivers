/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  readonly MAILGUN_API_KEY?: string;
  readonly MAILGUN_DOMAIN?: string;
  readonly MAILGUN_FROM?: string;
  readonly MAILGUN_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
