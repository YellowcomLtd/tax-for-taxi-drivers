import type { PortalStore, Submission, User } from './types';
import { defaultLines, ensureSubmissionShape, uid } from './calc';
import { monthsFromPeriodLabel } from './months';

const STORAGE_KEY = 'tft-portal-demo-v2';

export const DEMO_PASSWORD = 'demo123';

function seedUsers(): User[] {
  return [
    {
      id: 'user_admin',
      email: 'admin@taxfortaxidrivers.co.uk',
      password: DEMO_PASSWORD,
      fullName: 'Michael (Admin)',
      role: 'admin',
    },
    {
      id: 'user_taxi',
      email: 'james.driver@example.com',
      password: DEMO_PASSWORD,
      fullName: 'James Driver',
      role: 'client',
      tradeType: 'taxi',
    },
    {
      id: 'user_beauty',
      email: 'sara.beauty@example.com',
      password: DEMO_PASSWORD,
      fullName: 'Sara Beauty',
      role: 'client',
      tradeType: 'beautician',
    },
  ];
}

function seedSubmissions(): Submission[] {
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
  const periodLabel = 'Apr to Jun 2026';
  const months = monthsFromPeriodLabel(periodLabel);
  const [m1, m2, m3] = months;

  const taxiSample: Record<string, [number, number, number]> = {
    'Depot Rent': [660, 660, 660],
    Fuel: [340, 340, 340],
    Insurance: [300, 300, 300],
    'Taxi Rental/Repayment': [772, 772, 772],
    'Service Costs': [46, 46, 46],
    'Road Tax /PSV/Licencing': [45, 45, 45],
    Tolls: [45, 45, 45],
    'Interest /Pension': [45, 45, 45],
    Phone: [35, 35, 35],
    Accountancy: [45, 45, 45],
  };

  const taxiLines = defaultLines('taxi', months).map((line) => {
    const vals = taxiSample[line.category] ?? [0, 0, 0];
    return {
      ...line,
      values: {
        ...(m1 ? { [m1.id]: vals[0] } : {}),
        ...(m2 ? { [m2.id]: vals[1] } : {}),
        ...(m3 ? { [m3.id]: vals[2] } : {}),
      },
    };
  });

  const beautyMonths = monthsFromPeriodLabel(periodLabel);
  const [b1] = beautyMonths;

  return [
    {
      id: 'sub_taxi_ready',
      userId: 'user_taxi',
      periodLabel,
      tradeType: 'taxi',
      status: 'ready_to_sign',
      months,
      income: {
        ...(m1 ? { [m1.id]: 3530 } : {}),
        ...(m2 ? { [m2.id]: 3530 } : {}),
        ...(m3 ? { [m3.id]: 3530 } : {}),
      },
      lines: taxiLines,
      files: [{ id: uid('file'), name: 'fuel-receipts-apr.pdf', sizeLabel: '240 KB', uploadedAt: daysAgo(3) }],
      createdAt: daysAgo(10),
      updatedAt: daysAgo(1),
    },
    {
      id: 'sub_beauty_draft',
      userId: 'user_beauty',
      periodLabel,
      tradeType: 'beautician',
      status: 'draft',
      months: beautyMonths,
      income: b1 ? { [b1.id]: 2999 } : {},
      lines: defaultLines('beautician', beautyMonths).map((line) =>
        line.category === 'Premises Rent' && b1 ? { ...line, values: { [b1.id]: 999 } } : line
      ),
      files: [],
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
  ];
}

export function createSeedStore(): PortalStore {
  return {
    users: seedUsers(),
    submissions: seedSubmissions(),
    campaigns: [],
    session: null,
    notices: [
      {
        id: uid('notice'),
        at: new Date().toISOString(),
        to: 'james.driver@example.com',
        subject: 'Your declaration is ready to sign',
        body: 'Demo notice: James has a submission marked Ready to sign.',
      },
    ],
  };
}

function migrateStore(raw: PortalStore): PortalStore {
  return {
    ...raw,
    submissions: raw.submissions.map((s) => ensureSubmissionShape(s)),
  };
}

function loadLegacyV1(): PortalStore | null {
  try {
    const raw = localStorage.getItem('tft-portal-demo-v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalStore;
    return migrateStore(parsed);
  } catch {
    return null;
  }
}

export function loadStore(): PortalStore {
  if (typeof window === 'undefined') return createSeedStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = loadLegacyV1();
      const seed = legacy || createSeedStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return migrateStore(JSON.parse(raw) as PortalStore);
  } catch {
    const seed = createSeedStore();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
}

export function saveStore(store: PortalStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent('tft-portal-updated'));
}

export function resetStore() {
  localStorage.removeItem('tft-portal-demo-v1');
  const seed = createSeedStore();
  saveStore(seed);
  return seed;
}

export function updateStore(mutator: (store: PortalStore) => void) {
  const store = loadStore();
  mutator(store);
  saveStore(store);
  return store;
}
