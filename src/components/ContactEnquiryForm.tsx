import { useState, type FormEvent } from 'react';

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
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
        }),
      });
      const data = await res.json().catch(() => ({}));
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

      <button className="btn btn-y" type="submit" disabled={busy}>
        {busy ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
  );
}
