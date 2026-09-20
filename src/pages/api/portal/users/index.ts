import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { siteUrl } from '../../../../lib/env';
import { inviteEmailContent, resetEmailContent, sendEmail } from '../../../../lib/mail/mailgun';
import { error, json, mapProfile, requireAdmin } from '../../../../lib/portal/api';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const { supabase } = auth;
  const { data, error: qError } = await supabase.from('profiles').select('*').order('full_name');
  if (qError) return error(qError.message, 500);
  return json({ users: (data || []).map(mapProfile) });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const body = await context.request.json().catch(() => null);
  const email = String(body?.email || '')
    .trim()
    .toLowerCase();
  const fullName = String(body?.fullName || '').trim();
  const role = body?.role === 'admin' ? 'admin' : 'client';
  const tradeType = role === 'client' ? (body?.tradeType === 'beautician' ? 'beautician' : 'taxi') : null;

  if (!email || !fullName) return error('Name and email are required');

  const tempPassword = randomBytes(18).toString('base64url');
  const { admin, profile: actor } = auth;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: {
      role,
      ...(tradeType ? { trade_type: tradeType } : {}),
    },
    user_metadata: {
      full_name: fullName,
    },
  });

  if (createError || !created.user) {
    return error(createError?.message || 'Could not create user', 400);
  }

  await admin.from('profiles').upsert({
    id: created.user.id,
    email,
    full_name: fullName,
    role,
    trade_type: tradeType,
    active: true,
  });

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${siteUrl()}/portal/reset-password` },
  });

  if (linkError || !linkData.properties?.action_link) {
    return error(linkError?.message || 'User created but invite link failed', 500);
  }

  const mail = inviteEmailContent({
    fullName,
    email,
    role: role === 'admin' ? 'admin staff' : 'driver / client',
    resetUrl: linkData.properties.action_link,
  });
  const sent = await sendEmail({ to: email, ...mail });
  await admin.from('email_notices').insert({
    to_email: email,
    subject: mail.subject,
    body: mail.text,
    kind: 'invite',
    created_by: actor.id,
    meta: { mailgunOk: sent.ok },
  });

  const { data: profile } = await admin.from('profiles').select('*').eq('id', created.user.id).single();
  return json({
    ok: true,
    user: profile ? mapProfile(profile) : null,
    inviteSent: sent.ok,
  });
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireAdmin(context);
  if ('error' in auth && auth.error instanceof Response) return auth.error;

  const body = await context.request.json().catch(() => null);
  const id = String(body?.id || '');
  if (!id) return error('User id is required');

  const updates: Record<string, unknown> = {};
  if (typeof body?.fullName === 'string') updates.full_name = body.fullName.trim();
  if (typeof body?.active === 'boolean') updates.active = body.active;
  if (body?.tradeType === 'taxi' || body?.tradeType === 'beautician' || body?.tradeType === null) {
    updates.trade_type = body.tradeType;
  }
  if (body?.role === 'admin' || body?.role === 'client') {
    updates.role = body.role;
  }

  const { admin } = auth;

  if (Object.keys(updates).length) {
    const { error: upError } = await admin.from('profiles').update(updates).eq('id', id);
    if (upError) return error(upError.message, 400);
  }

  if (updates.role || updates.trade_type !== undefined) {
    const { data: profile } = await admin.from('profiles').select('*').eq('id', id).single();
    if (profile) {
      await admin.auth.admin.updateUserById(id, {
        app_metadata: {
          role: profile.role,
          ...(profile.trade_type ? { trade_type: profile.trade_type } : { trade_type: null }),
        },
        user_metadata: { full_name: profile.full_name },
      });
    }
  }

  if (body?.sendPasswordReset === true) {
    const { data: profile } = await admin.from('profiles').select('*').eq('id', id).single();
    if (!profile) return error('User not found', 404);

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
      options: { redirectTo: `${siteUrl()}/portal/reset-password` },
    });
    if (linkError || !linkData.properties?.action_link) {
      return error(linkError?.message || 'Could not create reset link', 500);
    }
    const mail = resetEmailContent({
      fullName: profile.full_name,
      resetUrl: linkData.properties.action_link,
    });
    const sent = await sendEmail({ to: profile.email, ...mail });
    await admin.from('email_notices').insert({
      to_email: profile.email,
      subject: mail.subject,
      body: mail.text,
      kind: 'password_reset',
      created_by: auth.profile.id,
      meta: { mailgunOk: sent.ok },
    });
    return json({ ok: true, resetSent: sent.ok });
  }

  const { data: profile } = await admin.from('profiles').select('*').eq('id', id).single();
  return json({ ok: true, user: profile ? mapProfile(profile) : null });
};
