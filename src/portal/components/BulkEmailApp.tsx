import { useEffect, useState } from 'react';
import PortalChrome from './PortalChrome';
import { formatDate } from '../lib/calc';
import { hydrateLiveStore } from '../lib/store';
import type { EmailCampaign } from '../lib/types';

export default function BulkEmailApp() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [sentMsg, setSentMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function sync() {
    const store = await hydrateLiveStore();
    setCampaigns(store?.campaigns || []);
  }

  useEffect(() => {
    void sync();
    const handler = () => void sync();
    window.addEventListener('tft-portal-updated', handler);
    return () => window.removeEventListener('tft-portal-updated', handler);
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSentMsg('');
    setBusy(true);
    try {
      const res = await fetch('/api/portal/email/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Send failed');
        return;
      }
      setSentMsg(`Sent to ${data.sentCount} of ${data.recipientCount} clients.`);
      setSubject('');
      setBody('');
      await sync();
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalChrome requireRole="admin" active="email">
      <h1 style={{ fontSize: 34, marginBottom: 8 }}>Bulk email</h1>
      <p className="portal-muted" style={{ marginBottom: 22 }}>
        Compose one message for every active client. Messages are sent through Mailgun and logged in the portal.
      </p>

      <div className="portal-grid-2">
        <form className="portal-card portal-form" onSubmit={(e) => void send(e)}>
          {error && <div className="portal-alert portal-alert-error">{error}</div>}
          {sentMsg && <div className="portal-alert portal-alert-success">{sentMsg}</div>}
          <div className="field">
            <label htmlFor="subject">Subject</label>
            <input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="body">Message</label>
            <textarea id="body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>
          <button className="btn btn-y" type="submit" disabled={busy}>
            Send to all clients
          </button>
        </form>

        <section className="portal-card">
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Sent history</h2>
          {campaigns.length === 0 && <p className="portal-muted">No campaigns yet.</p>}
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {campaigns.map((c) => (
              <li key={c.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
                <strong>{c.subject}</strong>
                <div className="portal-muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {formatDate(c.sentAt)} · {c.recipientCount} recipients
                </div>
                <p style={{ marginTop: 8, fontWeight: 500, fontSize: 14 }}>{c.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PortalChrome>
  );
}
