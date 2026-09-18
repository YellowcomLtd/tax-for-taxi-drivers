import { useEffect, useState } from 'react';
import PortalChrome from './PortalChrome';
import { formatDate, uid } from '../lib/calc';
import { loadStore, updateStore } from '../lib/store';
import type { EmailCampaign } from '../lib/types';

export default function BulkEmailApp() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [sentMsg, setSentMsg] = useState('');

  function sync() {
    setCampaigns(loadStore().campaigns);
  }

  useEffect(() => {
    sync();
    window.addEventListener('tft-portal-updated', sync);
    return () => window.removeEventListener('tft-portal-updated', sync);
  }, []);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const store = loadStore();
    const recipients = store.users.filter((u) => u.role === 'client');
    const campaign: EmailCampaign = {
      id: uid('camp'),
      subject: subject.trim(),
      body: body.trim(),
      sentBy: store.session?.email || 'admin',
      sentAt: new Date().toISOString(),
      recipientCount: recipients.length,
      recipients: recipients.map((r) => r.email),
    };
    updateStore((s) => {
      s.campaigns.unshift(campaign);
      recipients.forEach((r) => {
        s.notices.unshift({
          id: uid('notice'),
          at: campaign.sentAt,
          to: r.email,
          subject: campaign.subject,
          body: campaign.body,
        });
      });
    });
    setSentMsg(`Demo send complete - ${recipients.length} clients (MailGun will replace this).`);
    setSubject('');
    setBody('');
    sync();
  }

  return (
    <PortalChrome requireRole="admin" active="email">
      <h1 style={{ fontSize: 34, marginBottom: 8 }}>Bulk email</h1>
      <p className="portal-muted" style={{ marginBottom: 22 }}>Compose one message for every client. Static demo records the campaign locally instead of calling MailGun.</p>

      <div className="portal-grid-2">
        <form className="portal-card portal-form" onSubmit={send}>
          {sentMsg && <div className="portal-alert portal-alert-success">{sentMsg}</div>}
          <div className="field">
            <label htmlFor="subject">Subject</label>
            <input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="body">Message</label>
            <textarea id="body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>
          <button className="btn btn-y" type="submit">Send to all clients</button>
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
