export type PersonalizationFields = {
  fullName?: string | null;
  email?: string | null;
  companyName?: string | null;
  phone?: string | null;
};

export const EMAIL_VARIABLES = [
  { key: 'first_name', label: 'First name', sample: 'Alex', description: 'First word of their name' },
  { key: 'full_name', label: 'Full name', sample: 'Alex Murphy', description: 'Full display name' },
  { key: 'email', label: 'Email', sample: 'alex@example.com', description: 'Recipient email address' },
  { key: 'company', label: 'Company', sample: 'Murphy Taxis', description: 'Company name if held on file' },
  { key: 'phone', label: 'Phone', sample: '07700 900123', description: 'Phone number if held on file' },
] as const;

export type EmailVariableKey = (typeof EMAIL_VARIABLES)[number]['key'];

export function firstNameFrom(fullName?: string | null): string {
  const cleaned = String(fullName || '')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .trim();
  if (!cleaned) return '';
  return cleaned.split(/\s+/)[0] || '';
}

export function buildPersonalizationMap(fields: PersonalizationFields): Record<EmailVariableKey, string> {
  return {
    first_name: firstNameFrom(fields.fullName) || 'there',
    full_name: String(fields.fullName || '').trim() || 'there',
    email: String(fields.email || '').trim(),
    company: String(fields.companyName || '').trim() || 'your company',
    phone: String(fields.phone || '').trim() || '',
  };
}

/** Replace {{variable}} tokens (case-insensitive, optional spaces). Unknown tokens are left as-is. */
export function applyPersonalization(template: string, fields: PersonalizationFields): string {
  const map = buildPersonalizationMap(fields);
  return String(template || '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, rawKey: string) => {
    const key = rawKey.toLowerCase() as EmailVariableKey;
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      return map[key];
    }
    return match;
  });
}

export function variableToken(key: EmailVariableKey): string {
  return `{{${key}}}`;
}
