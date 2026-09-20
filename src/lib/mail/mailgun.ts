import { getMailgunConfig, siteUrl } from '../env';

interface SendEmailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
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
  if (input.replyTo) body.set('h:Reply-To', input.replyTo);

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

export function enquiryEmailContent(opts: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  gdprConsent: boolean;
}) {
  const subject = `Website enquiry from ${opts.name}`;
  const contactUrl = `${siteUrl()}/contact`;
  const phoneDisplay = opts.phone?.trim() ? opts.phone.trim() : 'Not provided';
  const phoneCell = opts.phone?.trim()
    ? `<a href="tel:${escapeHtml(opts.phone.replace(/\s+/g, ''))}" style="color:#141310;text-decoration:none;font-weight:700;">${escapeHtml(phoneDisplay)}</a>`
    : `<span style="color:#8f897d;">Not provided</span>`;
  const messageHtml = escapeHtml(opts.message).replace(/\n/g, '<br/>');
  const consentLabel = opts.gdprConsent ? 'Yes — privacy policy accepted' : 'No';
  const consentColor = opts.gdprConsent ? '#1d5c32' : '#8a1f11';
  const consentBg = opts.gdprConsent ? '#eaf7ee' : '#fdecea';

  const text = [
    'New general enquiry from the Tax for Taxi Drivers website.',
    '',
    `Name: ${opts.name}`,
    `Email: ${opts.email}`,
    `Phone: ${phoneDisplay}`,
    `GDPR consent: ${opts.gdprConsent ? 'Yes' : 'No'}`,
    '',
    'Message:',
    opts.message,
    '',
    `Sent from ${contactUrl}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1efe6;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1efe6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e4e0d4;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background-color:#141310;padding:22px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:#ffc400;margin-right:10px;"></div>
                    <span style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#ffc400;">Tax for Taxi Drivers</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:10px;">
                    <h1 style="margin:0;font-size:22px;line-height:1.25;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">New website enquiry</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#57544c;">
                Someone submitted the general enquiry form on the website. Reply directly to their email below.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fbfaf5;border:1px solid #e4e0d4;border-radius:12px;margin-bottom:20px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8f897d;">Name</p>
                    <p style="margin:0 0 16px;font-size:17px;font-weight:800;color:#141310;">${escapeHtml(opts.name)}</p>

                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8f897d;">Email</p>
                    <p style="margin:0 0 16px;font-size:16px;font-weight:700;">
                      <a href="mailto:${escapeHtml(opts.email)}" style="color:#141310;text-decoration:underline;text-decoration-color:#f0a500;text-underline-offset:3px;">${escapeHtml(opts.email)}</a>
                    </p>

                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8f897d;">Phone</p>
                    <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#141310;">${phoneCell}</p>

                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8f897d;">GDPR consent</p>
                    <p style="margin:0;">
                      <span style="display:inline-block;padding:6px 10px;border-radius:999px;background-color:${consentBg};color:${consentColor};font-size:13px;font-weight:700;">${escapeHtml(consentLabel)}</span>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8f897d;">Message</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:4px solid #ffc400;background-color:#fffdf5;border-radius:0 12px 12px 0;">
                <tr>
                  <td style="padding:16px 18px;font-size:15px;line-height:1.6;color:#141310;font-weight:500;">
                    ${messageHtml}
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                <tr>
                  <td style="border-radius:999px;background-color:#ffc400;">
                    <a href="mailto:${escapeHtml(opts.email)}?subject=${encodeURIComponent(`Re: Your enquiry to Tax for Taxi Drivers`)}"
                       style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:800;color:#141310;text-decoration:none;">
                      Reply to ${escapeHtml(opts.name.split(' ')[0] || 'enquirer')}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 22px;border-top:1px solid #e4e0d4;background-color:#fbfaf5;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8f897d;">
                Sent from the contact form at
                <a href="${contactUrl}" style="color:#57544c;font-weight:700;">${escapeHtml(contactUrl)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
