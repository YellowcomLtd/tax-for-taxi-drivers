import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { loadMergedClientImport } from '../../../lib/portal/importClients';
import { error, json, requireAdmin } from '../../../lib/portal/api';

export const prerender = false;

/**
 * Bulk-import GoCardless + HMRC client CSVs into profiles.
 * Never sends invite / engagement emails.
 */
export const POST: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const body = await context.request.json().catch(() => ({}));
  if (body?.confirm !== true) {
    return error('Pass confirm: true to run the import (no emails will be sent).');
  }

  let bundled;
  try {
    bundled = loadMergedClientImport();
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Could not read import CSVs', 500);
  }

  const { admin } = auth;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const client of bundled.clients) {
    try {
      const profilePayload = {
        email: client.email,
        full_name: client.fullName,
        role: 'client' as const,
        trade_type: 'taxi' as const,
        active: true,
        company_name: client.companyName || null,
        address_line1: client.addressLine1 || null,
        address_line2: client.addressLine2 || null,
        address_line3: client.addressLine3 || null,
        city: client.city || null,
        region: client.region || null,
        postal_code: client.postalCode || null,
        country_code: client.countryCode || 'GB',
        utr: client.utr || null,
        agent_reference: client.agentReference || null,
        gocardless_customer_id: client.gocardlessCustomerId || null,
      };

      const { data: existing } = await admin
        .from('profiles')
        .select('id')
        .eq('email', client.email)
        .maybeSingle();

      if (existing?.id) {
        const { error: upError } = await admin.from('profiles').update(profilePayload).eq('id', existing.id);
        if (upError) {
          // CRM columns may be missing until migration is run
          if (upError.message?.includes('column') || upError.code === '42703') {
            return error(
              'Profile CRM columns missing. Run supabase/migrations/20261019160000_profile_crm_fields.sql in Supabase first.',
              500
            );
          }
          errors.push(`${client.email}: ${upError.message}`);
          skipped += 1;
          continue;
        }
        updated += 1;
        continue;
      }

      const tempPassword = randomBytes(18).toString('base64url');
      const { data: createdAuth, error: createError } = await admin.auth.admin.createUser({
        email: client.email,
        password: tempPassword,
        email_confirm: true,
        app_metadata: { role: 'client', trade_type: 'taxi' },
        user_metadata: { full_name: client.fullName },
      });

      if (createError || !createdAuth.user) {
        // Already exists in Auth but not profiles — try lookup
        if (createError?.message?.toLowerCase().includes('already')) {
          skipped += 1;
          errors.push(`${client.email}: auth user exists — skipped create`);
          continue;
        }
        errors.push(`${client.email}: ${createError?.message || 'create failed'}`);
        skipped += 1;
        continue;
      }

      const { error: insError } = await admin.from('profiles').upsert({
        id: createdAuth.user.id,
        ...profilePayload,
      });

      if (insError) {
        if (insError.message?.includes('column') || insError.code === '42703') {
          return error(
            'Profile CRM columns missing. Run supabase/migrations/20261019160000_profile_crm_fields.sql in Supabase first.',
            500
          );
        }
        errors.push(`${client.email}: ${insError.message}`);
        skipped += 1;
        continue;
      }

      created += 1;
    } catch (err) {
      errors.push(`${client.email}: ${err instanceof Error ? err.message : 'unknown error'}`);
      skipped += 1;
    }
  }

  return json({
    ok: true,
    emailsSent: false,
    created,
    updated,
    skipped,
    sourceCount: bundled.clients.length,
    utrMatched: bundled.utrMatched,
    hmrcUnmatched: bundled.hmrcUnmatched,
    duplicateEmailsInFile: bundled.duplicateEmails.length,
    errors: errors.slice(0, 40),
  });
};
