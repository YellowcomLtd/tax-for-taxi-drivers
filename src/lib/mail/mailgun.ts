import { getMailgunConfig, siteUrl } from '../env';

interface SendEmailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { apiKey, domain, from: fromEnv, apiBase } = getMailgunConfig();
  if (!apiKey || !domain) {
    console.warn('[mailgun] Not configured — email skipped:', input.subject, '→', input.to);
    return { ok: false, error: 'Mailgun is not configured' };
  }

  const from = fromEnv || `Tax for Taxi Drivers <noreply@${domain}>`;
  const base = apiBase.replace(/\/$/, '');

  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const body = new URLSearchParams();
  body.set('from', from);
  body.set('to', recipients.join(','));
  body.set('subject', input.subject);
  body.set('text', input.text);
  if (input.html) body.set('html', input.html);

  const auth = Buffer.from(`api:${apiKey}`).toString('base64');

  try {
    const res = await fetch(`${base}/v3/${domain}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('[mailgun] send failed', res.status, detail);
      return { ok: false, error: `Mailgun error ${res.status}` };
    }

    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Mailgun request failed';
    console.error('[mailgun] send exception', message);
    return { ok: false, error: message };
  }
}

export function inviteEmailContent(opts: {
  fullName: string;
  email: string;
  role: string;
  resetUrl: string;
}) {
  const subject = 'Your Tax for Taxi Drivers portal account';
  const text = [
    `Hi ${opts.fullName},`,
    '',
    `An account has been created for you on the Tax for Taxi Drivers client portal (${opts.role}).`,
    '',
    `Sign in email: ${opts.email}`,
    `Set your password here (link expires soon):`,
    opts.resetUrl,
    '',
    `Portal: ${siteUrl()}/portal`,
    '',
    'If you did not expect this email, contact the office.',
  ].join('\n');

  const html = `
    <p>Hi ${escapeHtml(opts.fullName)},</p>
    <p>An account has been created for you on the Tax for Taxi Drivers client portal (${escapeHtml(opts.role)}).</p>
    <p><strong>Sign in email:</strong> ${escapeHtml(opts.email)}</p>
    <p><a href="${opts.resetUrl}">Set your password</a> (link expires soon).</p>
    <p>Then sign in at <a href="${siteUrl()}/portal">${siteUrl()}/portal</a>.</p>
    <p>If you did not expect this email, contact the office.</p>
  `;

  return { subject, text, html };
}

export function resetEmailContent(opts: { fullName: string; resetUrl: string }) {
  const subject = 'Reset your Tax for Taxi Drivers portal password';
  const text = [
    `Hi ${opts.fullName},`,
    '',
    'We received a request to reset your portal password.',
    `Reset it here: ${opts.resetUrl}`,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');
  const html = `
    <p>Hi ${escapeHtml(opts.fullName)},</p>
    <p>We received a request to reset your portal password.</p>
    <p><a href="${opts.resetUrl}">Reset your password</a></p>
    <p>If you did not request this, you can ignore this email.</p>
  `;
  return { subject, text, html };
}

export function otpEmailContent(opts: { fullName: string; code: string }) {
  const subject = 'Your portal sign-in code';
  const text = `Hi ${opts.fullName},\n\nYour one-time sign-in code is: ${opts.code}\n\nIt expires in 10 minutes.`;
  const html = `<p>Hi ${escapeHtml(opts.fullName)},</p><p>Your one-time sign-in code is:</p><p style="font-size:28px;letter-spacing:0.2em;font-weight:800">${escapeHtml(opts.code)}</p><p>It expires in 10 minutes.</p>`;
  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
