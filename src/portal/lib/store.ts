import type { EmailCampaign, PortalStore, Session, Submission, User } from './types';

const LIVE_CACHE_KEY = 'tft-portal-live-cache';

function emptyStore(): PortalStore {
  return {
    users: [],
    submissions: [],
    campaigns: [],
    session: null,
    notices: [],
  };
}

function readCache(): PortalStore {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = sessionStorage.getItem(LIVE_CACHE_KEY);
    if (!raw) return emptyStore();
    return JSON.parse(raw) as PortalStore;
  } catch {
    return emptyStore();
  }
}

function writeCache(store: PortalStore) {
  sessionStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent('tft-portal-updated'));
}

/** In-memory/session cache of the last bootstrap payload (not a source of truth). */
export function loadStore(): PortalStore {
  return readCache();
}

export function saveStore(store: PortalStore) {
  writeCache(store);
}

export function updateStore(mutator: (store: PortalStore) => void) {
  const store = loadStore();
  mutator(store);
  saveStore(store);
  return store;
}

export async function hydrateLiveStore(): Promise<PortalStore | null> {
  const res = await fetch('/api/portal/bootstrap', { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      saveStore(emptyStore());
    }
    return null;
  }
  const data = await res.json();
  const store: PortalStore = {
    users: data.users as User[],
    submissions: data.submissions as Submission[],
    campaigns: data.campaigns as EmailCampaign[],
    session: data.session as Session,
    notices: [],
  };
  saveStore(store);
  return store;
}

export async function persistSubmissionLive(submission: Submission): Promise<Submission | null> {
  const existing = loadStore().submissions.find((s) => s.id === submission.id);
  const method = existing ? 'PUT' : 'POST';
  const res = await fetch('/api/portal/submissions', {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submission),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const saved = data.submission as Submission;
  updateStore((s) => {
    const idx = s.submissions.findIndex((x) => x.id === saved.id);
    if (idx >= 0) s.submissions[idx] = saved;
    else s.submissions.unshift(saved);
  });
  return saved;
}

export async function apiLogout() {
  await fetch('/api/portal/auth/logout', { method: 'POST', credentials: 'include' });
  sessionStorage.removeItem(LIVE_CACHE_KEY);
  window.dispatchEvent(new CustomEvent('tft-portal-updated'));
}
