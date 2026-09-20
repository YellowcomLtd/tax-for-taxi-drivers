import type { APIRoute } from 'astro';
import { contactEnquiryTo } from '../../../lib/env';
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

    const mail = enquiryEmailContent({ name, email, phone, message, gdprConsent });
    const to = contactEnquiryTo();
    const sent = await sendEmail({
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
