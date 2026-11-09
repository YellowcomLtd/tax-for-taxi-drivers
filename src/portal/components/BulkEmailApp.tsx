import { useEffect, useMemo, useState } from 'react';
import PortalChrome from './PortalChrome';
import { formatDate } from '../lib/calc';
import { hydrateLiveStore } from '../lib/store';
import type { EmailCampaign, User } from '../lib/types';

type RoleFilter = 'all' | 'client' | 'admin';

function cleanName(value: string) {
  let out = value || '';
  for (let i = 0; i < 6; i++) {
    const next = out.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    if (next === out) break;
    out = next;
  }
  return out;
}

export default function BulkEmailApp() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('client');
  const [sentMsg, setSentMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function sync() {
    const store = await hydrateLiveStore();
    setCampaigns(store?.campaigns || []);
    setUsers((store?.users || []).filter((u) => u.active !== false && Boolean(u.email)));
  }

  useEffect(() => {
    void sync();
    const handler = () => void sync();
    window.addEventListener('tft-portal-updated', handler);
    return () => window.removeEventListener('tft-portal-updated', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => {
        if (roleFilter !== 'all' && u.role !== roleFilter) return false;
        if (!q) return true;
        return [u.fullName, u.email].join(' ').toLowerCase().includes(q);
      })
      .sort((a, b) => cleanName(a.fullName).localeCompare(cleanName(b.fullName), 'en', { sensitivity: 'base' }));
  }, [users, search, roleFilter]);

  const filteredIds = useMemo(() => filtered.map((u) => u.id), [filtered]);
  const selectedCount = selected.size;
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSentMsg('');
    if (selectedCount === 0) {
      setError('Select at least one recipient.');
      return;
    }
    if (
      !window.confirm(
        `Send this email to ${selectedCount} selected ${selectedCount === 1 ? 'person' : 'people'}?`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/portal/email/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          recipientIds: Array.from(selected),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Send failed');
        return;
      }
      setSentMsg(`Sent to ${data.sentCount} of ${data.recipientCount} recipients.`);
      setSubject('');
      setBody('');
      setSelected(new Set());
      await sync();
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalChrome requireRole="admin" active="email">
      <h1 style={{ fontSize: 34, marginBottom: 8 }}>Bulk email</h1>
      <p className="portal-muted" style={{ marginBottom: 22 }}>
        Search and tick recipients (clients or staff), or select all in the current filter. Messages go through Mailgun and are logged here.
      </p>

      <div className="portal-grid-2 bulk-layout">
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

          <div className="bulk-recipients">
            <div className="bulk-recipients-head">
              <h2>Recipients</h2>
              <span className="portal-muted">
                {selectedCount} selected
                {filtered.length !== users.length ? ` · showing ${filtered.length}` : ''}
              </span>
            </div>

            <div className="bulk-toolbar">
              <input
                className="users-search"
                type="search"
                placeholder="Search name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search recipients"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                aria-label="Filter by role"
              >
                <option value="client">Clients</option>
                <option value="admin">Staff / admins</option>
                <option value="all">Everyone</option>
              </select>
            </div>

            <div className="bulk-select-row">
              <label className="email-opt">
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} />
                <span>Select all shown</span>
              </label>
              {selectedCount > 0 && (
                <button type="button" className="btn btn-ghost btn-compact" onClick={clearSelection}>
                  Clear selection
                </button>
              )}
            </div>

            <div className="bulk-list">
              {filtered.length === 0 && <p className="portal-muted">No people match this search.</p>}
              {filtered.map((u) => (
                <label key={u.id} className="bulk-person">
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} />
                  <span className="bulk-person-text">
                    <strong>{cleanName(u.fullName)}</strong>
                    <span>{u.email}</span>
                  </span>
                  <span className={`users-pill ${u.role === 'admin' ? 'admin' : 'client'}`}>{u.role}</span>
                </label>
              ))}
            </div>
          </div>

          <button className="btn btn-y" type="submit" disabled={busy || selectedCount === 0}>
            {busy ? 'Sending…' : `Send to ${selectedCount || 0} selected`}
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
