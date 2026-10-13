import type { APIRoute } from 'astro';
import { contactEnquiryTo, getRecaptchaSecretKey } from '../../../lib/env';
import { enquiryEmailContent, sendEmail } from '../../../lib/mail/mailgun';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ error: 'Invalid request' }, 400);
    }

    // Honeypot — bots fill this; humans never see it.
    if (String((body as { company?: string }).company || '').trim()) {
      return json({ ok: true });
    }

    const name = String((body as { name?: string }).name || '').trim();
    const email = String((body as { email?: string }).email || '')
      .trim()
      .toLowerCase();
    const phone = String((body as { phone?: string }).phone || '').trim();
    const message = String((body as { message?: string }).message || '').trim();
    const gdprConsent = Boolean((body as { gdprConsent?: boolean }).gdprConsent);

    if (!name || name.length < 2) return json({ error: 'Please enter your name' }, 400);
    if (!email || !EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email address' }, 400);
    if (!message || message.length < 10) return json({ error: 'Please enter a short message (at least 10 characters)' }, 400);
    if (!gdprConsent) {
      return json({ error: 'Please confirm you agree to our privacy policy before sending' }, 400);
    }

    if (name.length > 120 || email.length > 200 || phone.length > 40 || message.length > 4000) {
      return json({ error: 'One or more fields are too long' }, 400);
    }

    const recaptchaToken = String((body as { recaptchaToken?: string }).recaptchaToken || '').trim();
    const captcha = await verifyRecaptcha(recaptchaToken, request.headers.get('x-forwarded-for'));
    if (!captcha.ok) {
      return json({ error: 'Please tick “I’m not a robot” before sending' }, 400);
    }

    const mail = enquiryEmailContent({ name, email, phone, message, gdprConsent });
    const to = contactEnquiryTo();
    const sent = await sendEmail({
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      replyTo: `${name} <${email}>`,
    });

    if (!sent.ok) {
      console.error('[contact] Mailgun failed', sent.error);
      return json(
        { error: 'We could not send your enquiry just now. Please try again or call the office.' },
        502
      );
    }

    return json({ ok: true, message: 'Thanks — your enquiry has been sent. We will get back to you shortly.' });
  } catch (err) {
    console.error('[contact] unhandled', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

/** Verifies a reCAPTCHA v2 token. Skipped (with a warning) until RECAPTCHA_SECRET_KEY is configured. */
async function verifyRecaptcha(token: string, forwardedFor: string | null): Promise<{ ok: boolean }> {
  const secret = getRecaptchaSecretKey();
  if (!secret) {
    console.warn('[contact] RECAPTCHA_SECRET_KEY not set — skipping captcha verification');
    return { ok: true };
  }
  if (!token) return { ok: false };

  const params = new URLSearchParams({ secret, response: token });
  const remoteip = forwardedFor?.split(',')[0]?.trim();
  if (remoteip) params.set('remoteip', remoteip);

  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (!data.success) console.warn('[contact] reCAPTCHA rejected', data['error-codes']);
    return { ok: Boolean(data.success) };
  } catch (err) {
    console.error('[contact] reCAPTCHA verify failed', err);
    return { ok: false };
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
