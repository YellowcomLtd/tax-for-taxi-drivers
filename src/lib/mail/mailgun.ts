import { getMailgunConfig } from '../env';
import { portalPublicUrl } from '../portal/authLinks';

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

/** Shared branded shell for every outbound email. */
export function brandedEmailHtml(opts: {
  title: string;
  preheader?: string;
  bodyHtml: string;
  footerHtml?: string;
}) {
  const site = portalPublicUrl();
  const footer =
    opts.footerHtml ||
    `Tax for Taxi Drivers · Belfast<br/>
     <a href="${site}" style="color:#57544c;font-weight:700;text-decoration:none;">${escapeHtml(site.replace(/^https?:\/\//, ''))}</a>
     &nbsp;·&nbsp;
     <a href="tel:02890132083" style="color:#57544c;font-weight:700;text-decoration:none;">02890 132083</a>`;

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1efe6;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>` : ''}
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
                    <h1 style="margin:0;font-size:22px;line-height:1.25;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">${escapeHtml(opts.title)}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-size:15px;line-height:1.55;color:#141310;">
              ${opts.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 22px;border-top:1px solid #e4e0d4;background-color:#fbfaf5;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8f897d;">
                ${footer}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function p(html: string, style = 'margin:0 0 16px;font-size:15px;line-height:1.55;color:#57544c;') {
  return `<p style="${style}">${html}</p>`;
}

function primaryButton(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
  <tr>
    <td style="border-radius:999px;background-color:#ffc400;">
      <a href="${href}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:800;color:#141310;text-decoration:none;">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`;
}

function detailCard(rows: { label: string; valueHtml: string }[]) {
  const inner = rows
    .map(
      (row, i) => `
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8f897d;">${escapeHtml(row.label)}</p>
      <p style="margin:0 ${i === rows.length - 1 ? '0' : '0 0 16px'};font-size:16px;font-weight:700;color:#141310;">${row.valueHtml}</p>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fbfaf5;border:1px solid #e4e0d4;border-radius:12px;margin-bottom:20px;">
  <tr><td style="padding:18px 20px;">${inner}</td></tr>
</table>`;
}

export function inviteEmailContent(opts: {
  fullName: string;
  email: string;
  role: string;
  resetUrl: string;
}) {
  const subject = 'Your Tax for Taxi Drivers portal account';
  const portal = `${portalPublicUrl()}/portal`;
  const text = [
    `Hi ${opts.fullName},`,
    '',
    `An account has been created for you on the Tax for Taxi Drivers client portal (${opts.role}).`,
    '',
    `Sign in email: ${opts.email}`,
    `Set your password here (link expires soon):`,
    opts.resetUrl,
    '',
    `Portal: ${portal}`,
    '',
    'If you did not expect this email, contact the office.',
  ].join('\n');

  const html = brandedEmailHtml({
    title: 'Your portal account is ready',
    preheader: 'Set your password to access the Tax for Taxi Drivers client portal.',
    bodyHtml: [
      p(`Hi <strong style="color:#141310;">${escapeHtml(opts.fullName)}</strong>,`),
      p(
        `An account has been created for you on the client portal (<strong style="color:#141310;">${escapeHtml(opts.role)}</strong>). Set a password to get started — the link expires soon.`
      ),
      detailCard([
        { label: 'Sign in email', valueHtml: escapeHtml(opts.email) },
        {
          label: 'Portal',
          valueHtml: `<a href="${portal}" style="color:#141310;text-decoration:underline;text-decoration-color:#f0a500;text-underline-offset:3px;">${escapeHtml(portal)}</a>`,
        },
      ]),
      primaryButton(opts.resetUrl, 'Set your password'),
      p('If you did not expect this email, contact the office on 02890 132083.', 'margin:0;font-size:13px;line-height:1.5;color:#8f897d;'),
    ].join(''),
  });

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

  const html = brandedEmailHtml({
    title: 'Reset your password',
    preheader: 'Use this secure link to choose a new portal password.',
    bodyHtml: [
      p(`Hi <strong style="color:#141310;">${escapeHtml(opts.fullName)}</strong>,`),
      p('We received a request to reset your Tax for Taxi Drivers portal password.'),
      primaryButton(opts.resetUrl, 'Reset password'),
      p('This link expires soon and can only be used once.', 'margin:0 0 16px;font-size:13px;line-height:1.5;color:#8f897d;'),
      p('If you did not request this, you can ignore this email.', 'margin:0;font-size:13px;line-height:1.5;color:#8f897d;'),
    ].join(''),
  });

  return { subject, text, html };
}

export function otpEmailContent(opts: { fullName: string; code: string }) {
  const subject = 'Your portal sign-in code';
  const text = `Hi ${opts.fullName},\n\nYour one-time sign-in code is: ${opts.code}\n\nIt expires in 10 minutes.`;

  const html = brandedEmailHtml({
    title: 'Your sign-in code',
    preheader: `Your portal code is ${opts.code}. It expires in 10 minutes.`,
    bodyHtml: [
      p(`Hi <strong style="color:#141310;">${escapeHtml(opts.fullName)}</strong>,`),
      p('Use this one-time code to finish signing in to the client portal:'),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
        <tr>
          <td align="center" style="padding:22px 16px;background-color:#fffdf5;border:1px solid #f3e4a8;border-radius:14px;">
            <div style="font-size:34px;letter-spacing:0.28em;font-weight:800;color:#141310;font-family:Consolas,'Courier New',monospace;">${escapeHtml(opts.code)}</div>
          </td>
        </tr>
      </table>`,
      p('It expires in 10 minutes. Never share this code with anyone.', 'margin:0;font-size:13px;line-height:1.5;color:#8f897d;'),
    ].join(''),
  });

  return { subject, text, html };
}

export function readyToSignEmailContent(opts: {
  fullName: string;
  periodLabel: string;
}) {
  const subject = 'Your declaration is ready to sign';
  const portal = `${portalPublicUrl()}/portal/client`;
  const text = [
    `Hi ${opts.fullName},`,
    '',
    `Your ${opts.periodLabel} submission is ready to sign.`,
    `Open the portal: ${portal}`,
    '',
    'Tax for Taxi Drivers',
  ].join('\n');

  const html = brandedEmailHtml({
    title: 'Ready to sign',
    preheader: `Your ${opts.periodLabel} declaration is ready to sign in the portal.`,
    bodyHtml: [
      p(`Hi <strong style="color:#141310;">${escapeHtml(opts.fullName)}</strong>,`),
      p(
        `Your <strong style="color:#141310;">${escapeHtml(opts.periodLabel)}</strong> submission is ready for you to review and sign.`
      ),
      primaryButton(portal, 'Open portal & sign'),
      p('If you have any questions, call the office on 02890 132083.', 'margin:0;font-size:13px;line-height:1.5;color:#8f897d;'),
    ].join(''),
  });

  return { subject, text, html };
}

export function bulkEmailContent(opts: { subject: string; body: string; fullName?: string }) {
  const greeting = opts.fullName ? `Hi ${opts.fullName},` : 'Hello,';
  const text = [greeting, '', opts.body, '', 'Tax for Taxi Drivers', `${portalPublicUrl()}/portal`].join('\n');
  const bodyHtml = escapeHtml(opts.body).replace(/\n/g, '<br/>');

  const html = brandedEmailHtml({
    title: opts.subject,
    preheader: opts.body.slice(0, 120),
    bodyHtml: [
      p(
        opts.fullName
          ? `Hi <strong style="color:#141310;">${escapeHtml(opts.fullName)}</strong>,`
          : 'Hello,'
      ),
      `<div style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#141310;font-weight:500;">${bodyHtml}</div>`,
      primaryButton(`${portalPublicUrl()}/portal`, 'Open client portal'),
    ].join(''),
  });

  return { subject: opts.subject, text, html };
}

export function enquiryEmailContent(opts: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  gdprConsent: boolean;
}) {
  const subject = `Website enquiry from ${opts.name}`;
  const contactUrl = `${portalPublicUrl()}/contact`;
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

  const html = brandedEmailHtml({
    title: 'New website enquiry',
    preheader: `Enquiry from ${opts.name} (${opts.email})`,
    bodyHtml: [
      p('Someone submitted the general enquiry form on the website. Reply directly to their email below.'),
      detailCard([
        { label: 'Name', valueHtml: escapeHtml(opts.name) },
        {
          label: 'Email',
          valueHtml: `<a href="mailto:${escapeHtml(opts.email)}" style="color:#141310;text-decoration:underline;text-decoration-color:#f0a500;text-underline-offset:3px;">${escapeHtml(opts.email)}</a>`,
        },
        { label: 'Phone', valueHtml: phoneCell },
        {
          label: 'GDPR consent',
          valueHtml: `<span style="display:inline-block;padding:6px 10px;border-radius:999px;background-color:${consentBg};color:${consentColor};font-size:13px;font-weight:700;">${escapeHtml(consentLabel)}</span>`,
        },
      ]),
      `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8f897d;">Message</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:4px solid #ffc400;background-color:#fffdf5;border-radius:0 12px 12px 0;margin-bottom:8px;">
         <tr>
           <td style="padding:16px 18px;font-size:15px;line-height:1.6;color:#141310;font-weight:500;">
             ${messageHtml}
           </td>
         </tr>
       </table>`,
      primaryButton(
        `mailto:${escapeHtml(opts.email)}?subject=${encodeURIComponent('Re: Your enquiry to Tax for Taxi Drivers')}`,
        `Reply to ${opts.name.split(' ')[0] || 'enquirer'}`
      ),
    ].join(''),
    footerHtml: `Sent from the contact form at
      <a href="${contactUrl}" style="color:#57544c;font-weight:700;">${escapeHtml(contactUrl)}</a>`,
  });

  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
