import { siteUrl } from '../env';

/** Customer-facing origin for portal auth emails — never a Vercel preview host. */
export function portalPublicUrl(): string {
  const raw = siteUrl().replace(/\/$/, '');
  try {
    const host = new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname;
    if (/vercel\.app$/i.test(host) || host === 'localhost' || host.endsWith('.local')) {
      return 'https://www.taxfortaxidrivers.co.uk';
    }
  } catch {
    return 'https://www.taxfortaxidrivers.co.uk';
  }
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

export function portalResetPasswordPath(): string {
  return `${portalPublicUrl()}/portal/reset-password`;
}

/**
 * Build a password-set URL that lands on our live portal.
 * Prefer hashed_token so the email never sends users through a misconfigured Supabase Site URL / Vercel host.
 */
export function passwordSetUrlFromGenerateLink(properties: {
  hashed_token?: string | null;
  action_link?: string | null;
}): string | null {
  const dest = portalResetPasswordPath();
  if (properties.hashed_token) {
    const url = new URL(dest);
    url.searchParams.set('token_hash', properties.hashed_token);
    url.searchParams.set('type', 'recovery');
    return url.toString();
  }
  if (properties.action_link) {
    try {
      const u = new URL(properties.action_link);
      u.searchParams.set('redirect_to', dest);
      return u.toString();
    } catch {
      return properties.action_link;
    }
  }
  return null;
}
