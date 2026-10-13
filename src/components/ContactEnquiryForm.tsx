import { useEffect, useRef, useState, type FormEvent } from 'react';

const RECAPTCHA_SITE_KEY =
  import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY || '6LcuhO0tAAAAAHbrsI7mCziB80tOK0FatfjwJz3t';
const RECAPTCHA_ONLOAD = '__tftRecaptchaOnload';

type Grecaptcha = {
  render: (
    el: HTMLElement,
    opts: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void }
  ) => number;
  reset: (id?: number) => void;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
    __tftRecaptchaOnload?: () => void;
  }
}

/** Loads the reCAPTCHA v2 script once (explicit render mode). */
function loadRecaptcha(): Promise<Grecaptcha> {
  return new Promise((resolve) => {
    if (window.grecaptcha?.render) return resolve(window.grecaptcha);
    const prev = window[RECAPTCHA_ONLOAD];
    window[RECAPTCHA_ONLOAD] = () => {
      prev?.();
      resolve(window.grecaptcha!);
    };
    if (!document.querySelector('script[data-recaptcha]')) {
      const s = document.createElement('script');
      s.src = `https://www.google.com/recaptcha/api.js?onload=${RECAPTCHA_ONLOAD}&render=explicit`;
      s.async = true;
      s.defer = true;
      s.dataset.recaptcha = '';
      document.head.appendChild(s);
    }
  });
}

export default function ContactEnquiryForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaId = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRecaptcha().then((g) => {
      if (cancelled || !captchaRef.current || captchaId.current !== null) return;
      captchaId.current = g.render(captchaRef.current, {
        sitekey: RECAPTCHA_SITE_KEY,
        callback: (token) => setCaptchaToken(token),
        'expired-callback': () => setCaptchaToken(''),
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function resetCaptcha() {
    setCaptchaToken('');
    if (captchaId.current !== null) window.grecaptcha?.reset(captchaId.current);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!captchaToken) {
      setError('Please tick “I’m not a robot” before sending');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/contact/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          message: message.trim(),
          gdprConsent,
          company: honeypot,
          recaptchaToken: captchaToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      // Tokens are single-use, so always get a fresh one for the next attempt.
      resetCaptcha();
      if (!res.ok) {
        setError((data as { error?: string }).error || `Could not send (${res.status})`);
        return;
      }
      setSuccess((data as { message?: string }).message || 'Thanks — your enquiry has been sent.');
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
      setGdprConsent(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your enquiry');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="enquiry-form" onSubmit={onSubmit} noValidate>
      {error && (
        <div className="enquiry-alert enquiry-alert-error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="enquiry-alert enquiry-alert-ok" role="status">
          {success}
        </div>
      )}

      <div className="enquiry-row">
        <div className="enquiry-field">
          <label htmlFor="enquiry-name">Full name</label>
          <input
            id="enquiry-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="enquiry-field">
          <label htmlFor="enquiry-email">Email</label>
          <input
            id="enquiry-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="enquiry-field">
        <label htmlFor="enquiry-phone">
          Phone <span className="optional">(optional)</span>
        </label>
        <input
          id="enquiry-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div className="enquiry-field">
        <label htmlFor="enquiry-message">How can we help?</label>
        <textarea
          id="enquiry-message"
          name="message"
          rows={5}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {/* Honeypot */}
      <div className="enquiry-hp" aria-hidden="true">
        <label htmlFor="enquiry-company">Company</label>
        <input
          id="enquiry-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <label className="enquiry-consent">
        <input
          type="checkbox"
          checked={gdprConsent}
          onChange={(e) => setGdprConsent(e.target.checked)}
          required
        />
        <span>
          I agree to Tax for Taxi Drivers processing my details to respond to this enquiry, as described in the{' '}
          <a href="/privacy">Privacy Policy</a>.
        </span>
      </label>

      <div className="enquiry-captcha" ref={captchaRef} />

      <button className="btn btn-y" type="submit" disabled={busy}>
        {busy ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
  );
}
