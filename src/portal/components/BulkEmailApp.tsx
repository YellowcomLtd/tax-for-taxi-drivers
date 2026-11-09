import { useEffect, useMemo, useRef, useState } from 'react';
import PortalChrome from './PortalChrome';
import {
  applyPersonalization,
  EMAIL_VARIABLES,
  firstNameFrom,
  variableToken,
  type EmailVariableKey,
} from '../../lib/mail/personalize';
import { formatDate } from '../lib/calc';
import { hydrateLiveStore } from '../lib/store';
import type { EmailCampaign, User } from '../lib/types';

type RoleFilter = 'all' | 'client' | 'admin';
type FieldTarget = 'subject' | 'body';

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
  const [activeField, setActiveField] = useState<FieldTarget>('body');
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

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

  const previewUser = useMemo(() => {
    if (selectedCount === 1) {
      return users.find((u) => selected.has(u.id)) || null;
    }
    return filtered[0] || users[0] || null;
  }, [selectedCount, selected, users, filtered]);

  const previewFields = useMemo(
    () => ({
      fullName: cleanName(previewUser?.fullName || 'Alex Murphy'),
      email: previewUser?.email || 'alex@example.com',
      companyName: previewUser?.companyName || 'Murphy Taxis',
      phone: previewUser?.phone || '07700 900123',
      portalUrl: 'https://www.taxfortaxidrivers.co.uk/portal',
    }),
    [previewUser]
  );

  const previewSubject = applyPersonalization(subject.trim() || 'Reminder for {{first_name}}', previewFields);
  const previewBody = applyPersonalization(
    body.trim() ||
      'Just a quick note for {{first_name}} at {{company}} — your portal is ready whenever you need it.',
    previewFields
  );
  const previewName = firstNameFrom(previewFields.fullName) || 'there';

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

  function insertVariable(key: EmailVariableKey) {
    const token = variableToken(key);
    const target = activeField;
    const el = target === 'subject' ? subjectRef.current : bodyRef.current;
    const value = target === 'subject' ? subject : body;
    const setValue = target === 'subject' ? setSubject : setBody;

    if (el) {
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
      setValue(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
      return;
    }

    setValue(`${value}${value ? ' ' : ''}${token}`);
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
        Personalise with variables, then search and tick recipients. Each person gets their own filled-in copy in the branded template.
      </p>

      <div className="portal-grid-2 bulk-layout">
        <form className="portal-card portal-form" onSubmit={(e) => void send(e)}>
          {error && <div className="portal-alert portal-alert-error">{error}</div>}
          {sentMsg && <div className="portal-alert portal-alert-success">{sentMsg}</div>}

          <div className="bulk-vars">
            <div className="bulk-vars-head">
              <h2>Personalisation</h2>
              <span className="portal-muted">
                Click to insert into {activeField === 'subject' ? 'subject' : 'message'}
              </span>
            </div>
            <div className="bulk-var-chips" role="list">
              {EMAIL_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className="bulk-var-chip"
                  title={v.description}
                  onClick={() => insertVariable(v.key)}
                >
                  <span>{v.label}</span>
                  <code>{`{{${v.key}}}`}</code>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              ref={subjectRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => setActiveField('subject')}
              placeholder="e.g. Reminder for {{first_name}}"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="body">Message</label>
            <textarea
              id="body"
              ref={bodyRef}
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onFocus={() => setActiveField('body')}
              placeholder="Hi — this is a note for {{first_name}} at {{company}}…"
              required
            />
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

        <div className="bulk-side">
          <section className="portal-card bulk-preview-card">
            <div className="bulk-preview-head">
              <h2>Live preview</h2>
              <span className="portal-muted">
                {previewUser
                  ? `Showing as ${cleanName(previewUser.fullName)}`
                  : 'Sample recipient'}
              </span>
            </div>
            <div className="email-preview-frame" aria-live="polite">
              <article className="email-preview">
                <header className="email-preview-brand">
                  <img src="/email-logo.png" alt="" width={44} height={44} />
                  <div>
                    <strong>Tax for Taxi Drivers</strong>
                    <span>Tax made easy</span>
                  </div>
                </header>
                <div className="email-preview-accent" />
                <div className="email-preview-body">
                  <p className="email-preview-eyebrow">Message from the office</p>
                  <h3>{previewSubject}</h3>
                  <p className="email-preview-greeting">
                    Hi <strong>{previewName}</strong>,
                  </p>
                  <div className="email-preview-message">
                    {previewBody.split('\n').map((line, i) => (
                      <span key={`${i}-${line.slice(0, 12)}`}>
                        {line}
                        {i < previewBody.split('\n').length - 1 ? <br /> : null}
                      </span>
                    ))}
                  </div>
                  <span className="email-preview-cta">Open client portal</span>
                  <p className="email-preview-signoff">
                    Kind regards,
                    <br />
                    <strong>Tax for Taxi Drivers</strong>
                  </p>
                </div>
                <footer className="email-preview-footer">
                  <strong>Tax for Taxi Drivers</strong> · Tax made easy
                  <br />
                  Unit 4 - North City Business Centre, 2 Duncairn Gardens, Belfast BT15 2GG
                  <br />
                  02890 132083 · www.taxfortaxidrivers.co.uk
                </footer>
              </article>
            </div>
          </section>

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
      </div>
    </PortalChrome>
  );
}
