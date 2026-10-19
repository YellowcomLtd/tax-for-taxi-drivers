import { parse } from 'csv-parse/sync';
import gocardlessCsv from '../../data/imports/customers_index-export-EX01M5ABKZQC43ZD64BWEYN7SR48.csv?raw';
import hmrcCsv from '../../data/imports/SAAgentClientList.csv?raw';

export type ImportedClientRow = {
  email: string;
  fullName: string;
  givenName?: string;
  familyName?: string;
  companyName?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
  utr?: string;
  agentReference?: string;
  gocardlessCustomerId?: string;
};

function normName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|miss|dr)\b\.?/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCsv(raw: string): Record<string, string>[] {
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as Record<string, string>[];
}

/** Merge GoCardless customers (email+address) with HMRC agent list (UTR) by name. No emails sent. */
export function loadMergedClientImport(): {
  clients: ImportedClientRow[];
  skippedNoEmail: number;
  utrMatched: number;
  hmrcUnmatched: number;
  duplicateEmails: string[];
} {
  const gc = parseCsv(gocardlessCsv);
  const hmrc = parseCsv(hmrcCsv);

  const byFull = new Map<string, Record<string, string>>();
  for (const row of hmrc) {
    const ref = normName(row['Agent Own reference'] || '');
    if (!ref || ref === 'null') continue;
    if (!byFull.has(ref)) byFull.set(ref, row);
  }

  function findHmrc(given: string, family: string, fullName: string) {
    const fullKey = normName(fullName);
    if (byFull.has(fullKey)) return byFull.get(fullKey);
    const first = given.split(/\s+/)[0] || '';
    const shortKey = normName(`${first} ${family}`);
    if (shortKey && byFull.has(shortKey)) return byFull.get(shortKey);
    return undefined;
  }

  const seenEmails = new Set<string>();
  const duplicateEmails: string[] = [];
  const clients: ImportedClientRow[] = [];
  let skippedNoEmail = 0;
  let utrMatched = 0;

  for (const row of gc) {
    const email = String(row.email || '')
      .trim()
      .toLowerCase();
    if (!email) {
      skippedNoEmail += 1;
      continue;
    }
    if (seenEmails.has(email)) {
      duplicateEmails.push(email);
      continue;
    }
    seenEmails.add(email);

    const given = String(row.given_name || '').trim();
    const family = String(row.family_name || '').trim();
    const fullName = [given, family].filter(Boolean).join(' ') || email;
    const hmrcHit = findHmrc(given, family, fullName);
    if (hmrcHit) utrMatched += 1;

    clients.push({
      email,
      fullName,
      givenName: given || undefined,
      familyName: family || undefined,
      companyName: String(row.company_name || '').trim() || undefined,
      addressLine1: String(row.address_line1 || '').trim() || undefined,
      addressLine2: String(row.address_line2 || '').trim() || undefined,
      addressLine3: String(row.address_line3 || '').trim() || undefined,
      city: String(row.city || '').trim() || undefined,
      region: String(row.region || '').trim() || undefined,
      postalCode: String(row.postal_code || '').trim() || undefined,
      countryCode: String(row.country_code || '').trim() || 'GB',
      utr: hmrcHit ? String(hmrcHit['Tax Reference number'] || '').trim() || undefined : undefined,
      agentReference: hmrcHit
        ? String(hmrcHit['Agent Own reference'] || '').trim() || undefined
        : undefined,
      gocardlessCustomerId: String(row.id || '').trim() || undefined,
    });
  }

  const hmrcNamed = hmrc.filter((r) => {
    const ref = normName(r['Agent Own reference'] || '');
    return Boolean(ref && ref !== 'null');
  }).length;

  return {
    clients,
    skippedNoEmail,
    utrMatched,
    hmrcUnmatched: Math.max(0, hmrcNamed - utrMatched),
    duplicateEmails,
  };
}
