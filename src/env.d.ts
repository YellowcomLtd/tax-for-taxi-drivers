/// <reference types="astro/client" />

declare module '*.csv?raw' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_RECAPTCHA_SITE_KEY?: string;
  readonly RECAPTCHA_SECRET_KEY?: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  readonly MAILGUN_API_KEY?: string;
  readonly MAILGUN_DOMAIN?: string;
  readonly MAILGUN_FROM?: string;
  readonly MAILGUN_API_BASE?: string;
  readonly CONTACT_ENQUIRY_TO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
