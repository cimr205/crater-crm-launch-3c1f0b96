import { randomUUID } from 'crypto';
import type { Application, NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { Session } from '@supabase/supabase-js';
import { query, withTransaction } from '../core/database';
import { authMiddleware, requireGlobalAdmin, requirePermission } from '../core/auth';
import { ok, fail } from '../core/http';
import { generateInviteCode } from '../core/inviteCode';
import { supabaseAdmin, supabaseAnon } from '../core/supabase';
import { env } from '../config/env';

const paymentStatusSchema = z.enum(['pending', 'active', 'past_due', 'cancelled', 'trial']);

const ownerSignupSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  company: z.object({
    name: z.string().min(2),
    cvr: z.string().max(64).optional(),
    address: z.string().max(255).optional(),
    country: z.string().max(64).optional(),
    phone: z.string().max(64).optional(),
    email: z.string().email().optional(),
    plan: z.string().min(2),
    user_limit: z.number().int().min(1).max(100000).optional(),
    payment_status: paymentStatusSchema.default('pending'),
  }),
});

const memberSignupSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  invitation_code: z.string().min(5),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(20),
});

type AppUserRow = {
  id: string;
  company_id: string;
  company_name: string;
  company_is_active: boolean;
  role: string;
  email: string;
  full_name: string | null;
  is_global_admin: boolean;
  permissions: string[];
};

async function getAppUserProfile(userId: string) {
  const rows = await query<AppUserRow>(
    `
    select
      u.id,
      u.company_id,
      c.name as company_name,
      c.is_active as company_is_active,
      u.role,
      u.email,
      u.full_name,
      u.is_global_admin,
      coalesce(array_agg(rp.permission) filter (where rp.permission is not null), '{}') as permissions
    from users u
    join companies c on c.id = u.company_id
    left join role_permissions rp on rp.role_slug = u.role
    where u.id = $1
    group by u.id, c.id
    `,
    [userId]
  );

  return rows[0] || null;
}

function serializeSession(session: Session | null) {
  if (!session) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
  };
}

function mapProfile(profile: AppUserRow) {
  return {
    id: profile.id,
    company_id: profile.company_id,
    company_name: profile.company_name,
    role: profile.role,
    email: profile.email,
    full_name: profile.full_name,
    is_global_admin: profile.is_global_admin,
    permissions: profile.permissions || [],
  };
}

async function generateUniqueInviteCode() {
  for (let i = 0; i < 25; i += 1) {
    const candidate = generateInviteCode();
    const rows = await query<{ id: string }>('select id from companies where invite_code = $1 limit 1', [candidate]);
    if (!rows[0]) return candidate;
  }
  return `${generateInviteCode()}-${Math.floor(Math.random() * 9)}`;
}

async function signInViaSupabase(email: string, password: string) {
  const result = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.session || !result.data.user) {
    return {
      error: result.error?.message || 'Login failed',
      session: null,
      userId: null,
    };
  }

  return {
    error: null,
    session: result.data.session,
    userId: result.data.user.id,
  };
}

export function registerRoutes(app: Application) {
  app.get('/api/health', async (_req: Request, res: Response) => {
    ok(res, { status: 'ok', service: 'railway-backend', auth: 'supabase' });
  });

  app.post('/api/v1/auth/validate-invite-code', async (req: Request, res: Response) => {
    const schema = z.object({ invitation_code: z.string().min(5) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 400, 'invalid_payload', 'Invalid payload', parsed.error.flatten());
      return;
    }

    const rows = await query<{ id: string; name: string; is_active: boolean }>(
      `select id, name, is_active from companies where invite_code = $1 limit 1`,
      [parsed.data.invitation_code.toUpperCase()]
    );

    const company = rows[0];
    if (!company) {
      fail(res, 404, 'invite_code_invalid', 'Invitation code is invalid');
      return;
    }
    if (!company.is_active) {
      fail(res, 403, 'company_inactive', 'Company is inactive');
      return;
    }

    ok(res, {
      company_id: company.id,
      company_name: company.name,
      valid: true,
    });
  });

  app.post('/api/v1/auth/signup-owner', async (req: Request, res: Response) => {
    const parsed = ownerSignupSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 400, 'invalid_payload', 'Invalid payload', parsed.error.flatten());
      return;
    }

    const email = parsed.data.email.toLowerCase().trim();
    const isGlobalAdmin = env.globalAdminEmails.includes(email);

    const { data: authUserData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.full_name },
    });

    if (createAuthError || !authUserData.user) {
      fail(res, 400, 'auth_create_failed', createAuthError?.message || 'Failed to create auth user');
      return;
    }

    const authUserId = authUserData.user.id;

    try {
      const inviteCode = await generateUniqueInviteCode();
      await withTransaction(async (client) => {
        const companyResult = await client.query<{ id: string }>(
          `
          insert into companies (
            name, cvr, address, country, phone, email, plan, payment_status, invite_code, user_limit, created_by
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          returning id
          `,
          [
            parsed.data.company.name,
            parsed.data.company.cvr || null,
            parsed.data.company.address || null,
            parsed.data.company.country || null,
            parsed.data.company.phone || null,
            parsed.data.company.email || email,
            parsed.data.company.plan,
            parsed.data.company.payment_status,
            inviteCode,
            parsed.data.company.user_limit || null,
            authUserId,
          ]
        );

        const companyId = companyResult.rows[0]?.id;
        if (!companyId) {
          throw new Error('Failed to create company');
        }

        await client.query(
          `
          insert into users (id, company_id, role, email, full_name, is_global_admin)
          values ($1,$2,'owner',$3,$4,$5)
          `,
          [authUserId, companyId, email, parsed.data.full_name, isGlobalAdmin]
        );

        await client.query(
          `insert into activity_logs (company_id, user_id, action, metadata)
           values ($1, $2, $3, $4::jsonb)`,
          [companyId, authUserId, 'company.owner_signup', JSON.stringify({ email })]
        );
      });

      const signIn = await signInViaSupabase(email, parsed.data.password);
      if (signIn.error || !signIn.userId) {
        fail(res, 500, 'signin_failed', signIn.error || 'Could not sign in after signup');
        return;
      }

      const profile = await getAppUserProfile(signIn.userId);
      if (!profile) {
        fail(res, 500, 'profile_missing', 'User profile was not created');
        return;
      }
      if (!profile.company_is_active && !profile.is_global_admin) {
        fail(res, 403, 'company_inactive', 'Company is inactive');
        return;
      }

      ok(
        res,
        {
          session: serializeSession(signIn.session),
          user: mapProfile(profile),
          company: {
            id: profile.company_id,
            name: profile.company_name,
          },
        },
        201
      );
    } catch (error) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      fail(res, 500, 'signup_failed', (error as Error).message || 'Failed to complete signup');
    }
  });

  app.post('/api/v1/auth/signup-member', async (req: Request, res: Response) => {
    const parsed = memberSignupSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 400, 'invalid_payload', 'Invalid payload', parsed.error.flatten());
      return;
    }

    const email = parsed.data.email.toLowerCase().trim();
    const inviteCode = parsed.data.invitation_code.toUpperCase().trim();

    const companies = await query<{ id: string; name: string; is_active: boolean }>(
      `select id, name, is_active from companies where invite_code = $1 limit 1`,
      [inviteCode]
    );

    const company = companies[0];
    if (!company) {
      fail(res, 404, 'invite_code_invalid', 'Invitation code is invalid');
      return;
    }
    if (!company.is_active) {
      fail(res, 403, 'company_inactive', 'Company is inactive');
      return;
    }

    const { data: authUserData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.full_name },
    });

    if (createAuthError || !authUserData.user) {
      fail(res, 400, 'auth_create_failed', createAuthError?.message || 'Failed to create auth user');
      return;
    }

    const authUserId = authUserData.user.id;

    try {
      await withTransaction(async (client) => {
        await client.query(
          `
          insert into users (id, company_id, role, email, full_name, is_global_admin)
          values ($1,$2,'employee',$3,$4,false)
          `,
          [authUserId, company.id, email, parsed.data.full_name]
        );

        await client.query(
          `insert into activity_logs (company_id, user_id, action, metadata)
           values ($1, $2, $3, $4::jsonb)`,
          [company.id, authUserId, 'company.member_signup', JSON.stringify({ email, inviteCode })]
        );
      });

      const signIn = await signInViaSupabase(email, parsed.data.password);
      if (signIn.error || !signIn.userId) {
        fail(res, 500, 'signin_failed', signIn.error || 'Could not sign in after signup');
        return;
      }

      const profile = await getAppUserProfile(signIn.userId);
      if (!profile) {
        fail(res, 500, 'profile_missing', 'User profile was not created');
        return;
      }

      ok(
        res,
        {
          session: serializeSession(signIn.session),
          user: mapProfile(profile),
          company: {
            id: profile.company_id,
            name: profile.company_name,
          },
        },
        201
      );
    } catch (error) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      fail(res, 500, 'signup_failed', (error as Error).message || 'Failed to complete member signup');
    }
  });

  app.post('/api/v1/auth/login', async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 400, 'invalid_payload', 'Invalid payload', parsed.error.flatten());
      return;
    }

    const signIn = await signInViaSupabase(parsed.data.email.toLowerCase().trim(), parsed.data.password);
    if (signIn.error || !signIn.userId) {
      fail(res, 401, 'invalid_credentials', 'Invalid email or password');
      return;
    }

    const profile = await getAppUserProfile(signIn.userId);
    if (!profile) {
      fail(res, 403, 'profile_missing', 'No company user profile found');
      return;
    }
    if (!profile.company_is_active && !profile.is_global_admin) {
      fail(res, 403, 'company_inactive', 'Company is inactive. Access blocked.');
      return;
    }

    ok(res, {
      session: serializeSession(signIn.session),
      user: mapProfile(profile),
      company: {
        id: profile.company_id,
        name: profile.company_name,
      },
    });
  });

  app.post('/api/v1/auth/refresh', async (req: Request, res: Response) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 400, 'invalid_payload', 'Invalid payload', parsed.error.flatten());
      return;
    }

    const result = await supabaseAnon.auth.refreshSession({ refresh_token: parsed.data.refresh_token });
    if (result.error || !result.data.user || !result.data.session) {
      fail(res, 401, 'refresh_failed', result.error?.message || 'Refresh token invalid');
      return;
    }

    const profile = await getAppUserProfile(result.data.user.id);
    if (!profile) {
      fail(res, 403, 'profile_missing', 'No company user profile found');
      return;
    }
    if (!profile.company_is_active && !profile.is_global_admin) {
      fail(res, 403, 'company_inactive', 'Company is inactive. Access blocked.');
      return;
    }

    ok(res, {
      session: serializeSession(result.data.session),
      user: mapProfile(profile),
      company: {
        id: profile.company_id,
        name: profile.company_name,
      },
    });
  });

  app.get('/api/v1/auth/me', authMiddleware, async (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) {
      fail(res, 401, 'unauthorized', 'Authentication required');
      return;
    }

    ok(res, {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        role: user.role,
        company_id: user.companyId,
        company_name: user.companyName,
        is_global_admin: user.isGlobalAdmin,
        permissions: user.permissions,
      },
    });
  });

  app.get('/api/v1/company/settings', authMiddleware, requirePermission('company.read'), async (req: Request, res: Response) => {
    const authUser = req.authUser!;
    const rows = await query<{
      id: string;
      name: string;
      cvr: string | null;
      address: string | null;
      country: string | null;
      phone: string | null;
      email: string | null;
      plan: string;
      user_limit: number | null;
      payment_status: string;
      invite_code: string;
      is_active: boolean;
      created_at: string;
    }>(
      `
      select id, name, cvr, address, country, phone, email, plan, user_limit, payment_status, invite_code, is_active, created_at
      from companies
      where id = $1
      limit 1
      `,
      [authUser.companyId]
    );

    const company = rows[0];
    if (!company) {
      fail(res, 404, 'company_not_found', 'Company not found');
      return;
    }

    ok(res, {
      ...company,
      invite_code: authUser.role === 'owner' || authUser.isGlobalAdmin ? company.invite_code : null,
    });
  });

  app.patch('/api/v1/company/settings', authMiddleware, requirePermission('company.update'), async (req: Request, res: Response) => {
    const authUser = req.authUser!;
    const schema = z.object({
      name: z.string().min(2).optional(),
      cvr: z.string().max(64).nullable().optional(),
      address: z.string().max(255).nullable().optional(),
      country: z.string().max(64).nullable().optional(),
      phone: z.string().max(64).nullable().optional(),
      email: z.string().email().nullable().optional(),
      plan: z.string().min(2).optional(),
      user_limit: z.number().int().min(1).max(100000).nullable().optional(),
      payment_status: paymentStatusSchema.optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 400, 'invalid_payload', 'Invalid payload', parsed.error.flatten());
      return;
    }

    if ((parsed.data.plan || parsed.data.payment_status) && authUser.role !== 'owner' && !authUser.isGlobalAdmin) {
      fail(res, 403, 'forbidden', 'Only owner can update plan and payment status');
      return;
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    const addField = (column: string, value: unknown) => {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    };

    if (parsed.data.name !== undefined) addField('name', parsed.data.name);
    if (parsed.data.cvr !== undefined) addField('cvr', parsed.data.cvr);
    if (parsed.data.address !== undefined) addField('address', parsed.data.address);
    if (parsed.data.country !== undefined) addField('country', parsed.data.country);
    if (parsed.data.phone !== undefined) addField('phone', parsed.data.phone);
    if (parsed.data.email !== undefined) addField('email', parsed.data.email);
    if (parsed.data.plan !== undefined) addField('plan', parsed.data.plan);
    if (parsed.data.user_limit !== undefined) addField('user_limit', parsed.data.user_limit);
    if (parsed.data.payment_status !== undefined) addField('payment_status', parsed.data.payment_status);

    if (!fields.length) {
      fail(res, 400, 'no_changes', 'No fields to update');
      return;
    }

    values.push(authUser.companyId);

    const rows = await query<{
      id: string;
      name: string;
      cvr: string | null;
      address: string | null;
      country: string | null;
      phone: string | null;
      email: string | null;
      plan: string;
      user_limit: number | null;
      payment_status: string;
      invite_code: string;
      is_active: boolean;
      created_at: string;
    }>(
      `
      update companies
      set ${fields.join(', ')}
      where id = $${values.length}
      returning id, name, cvr, address, country, phone, email, plan, user_limit, payment_status, invite_code, is_active, created_at
      `,
      values
    );

    ok(res, {
      ...rows[0],
      invite_code: authUser.role === 'owner' || authUser.isGlobalAdmin ? rows[0]?.invite_code : null,
    });
  });

  app.post('/api/v1/company/invite-code/regenerate', authMiddleware, async (req: Request, res: Response) => {
    const authUser = req.authUser!;
    if (authUser.role !== 'owner' && !authUser.isGlobalAdmin) {
      fail(res, 403, 'forbidden', 'Only owner can regenerate invitation code');
      return;
    }

    const inviteCode = await generateUniqueInviteCode();
    const rows = await query<{ invite_code: string }>(
      'update companies set invite_code = $1 where id = $2 returning invite_code',
      [inviteCode, authUser.companyId]
    );

    ok(res, { invite_code: rows[0]?.invite_code || inviteCode });
  });

  app.get('/api/v1/company/users', authMiddleware, requirePermission('members.read'), async (req: Request, res: Response) => {
    const authUser = req.authUser!;
    const rows = await query<{
      id: string;
      role: string;
      email: string;
      full_name: string | null;
      created_at: string;
    }>(
      `
      select id, role, email, full_name, created_at
      from users
      where company_id = $1
      order by created_at asc
      `,
      [authUser.companyId]
    );

    ok(res, rows);
  });

  app.patch('/api/v1/company/users/:id/role', authMiddleware, requirePermission('members.update'), async (req: Request, res: Response) => {
    const authUser = req.authUser!;
    const schema = z.object({ role: z.string().min(2).max(64) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 400, 'invalid_payload', 'Invalid payload', parsed.error.flatten());
      return;
    }

    const roleRows = await query<{ slug: string }>('select slug from roles where slug = $1 limit 1', [parsed.data.role]);
    if (!roleRows[0]) {
      fail(res, 404, 'role_not_found', 'Role does not exist');
      return;
    }

    const rows = await query<{ id: string; role: string }>(
      `
      update users
      set role = $1
      where id = $2 and company_id = $3
      returning id, role
      `,
      [parsed.data.role, req.params.id, authUser.companyId]
    );

    if (!rows[0]) {
      fail(res, 404, 'user_not_found', 'User not found in company');
      return;
    }

    await query(
      `insert into activity_logs (company_id, user_id, action, metadata)
       values ($1,$2,$3,$4::jsonb)`,
      [authUser.companyId, authUser.id, 'user.role_updated', JSON.stringify({ target_user_id: req.params.id, role: parsed.data.role })]
    );

    ok(res, rows[0]);
  });

  app.get('/api/v1/roles', authMiddleware, async (_req: Request, res: Response) => {
    const rows = await query<{ slug: string; label: string; description: string | null; is_system: boolean }>(
      'select slug, label, description, is_system from roles order by slug asc'
    );
    ok(res, rows);
  });

  app.post('/api/v1/roles', authMiddleware, async (req: Request, res: Response) => {
    const authUser = req.authUser!;
    if (authUser.role !== 'owner' && !authUser.isGlobalAdmin) {
      fail(res, 403, 'forbidden', 'Only owner can create roles');
      return;
    }

    const schema = z.object({
      slug: z.string().min(2).max(64).regex(/^[a-z0-9_\-]+$/),
      label: z.string().min(2).max(100),
      description: z.string().max(255).optional(),
      permissions: z.array(z.string().min(2)).default([]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 400, 'invalid_payload', 'Invalid payload', parsed.error.flatten());
      return;
    }

    try {
      await withTransaction(async (client) => {
        await client.query(
          `insert into roles (slug, label, description, is_system)
           values ($1,$2,$3,false)`,
          [parsed.data.slug, parsed.data.label, parsed.data.description || null]
        );

        for (const permission of parsed.data.permissions) {
          await client.query(
            `insert into role_permissions (role_slug, permission) values ($1,$2)`,
            [parsed.data.slug, permission]
          );
        }
      });

      ok(res, {
        slug: parsed.data.slug,
        label: parsed.data.label,
        description: parsed.data.description || null,
        permissions: parsed.data.permissions,
      }, 201);
    } catch (error) {
      fail(res, 409, 'role_create_failed', (error as Error).message || 'Could not create role');
    }
  });

  app.get('/api/v1/company/activity-logs', authMiddleware, requirePermission('activity.read'), async (req: Request, res: Response) => {
    const authUser = req.authUser!;
    const rows = await query<{
      id: string;
      company_id: string;
      user_id: string | null;
      action: string;
      metadata: unknown;
      timestamp: string;
    }>(
      `
      select id, company_id, user_id, action, metadata, timestamp
      from activity_logs
      where company_id = $1
      order by timestamp desc
      limit 200
      `,
      [authUser.companyId]
    );

    ok(res, rows);
  });

  app.get('/api/v1/admin/companies', authMiddleware, requireGlobalAdmin, async (_req: Request, res: Response) => {
    const rows = await query<{
      id: string;
      name: string;
      plan: string;
      payment_status: string;
      is_active: boolean;
      created_at: string;
      user_count: string;
    }>(
      `
      select
        c.id,
        c.name,
        c.plan,
        c.payment_status,
        c.is_active,
        c.created_at,
        count(u.id)::text as user_count
      from companies c
      left join users u on u.company_id = c.id
      group by c.id
      order by c.created_at desc
      `
    );

    ok(
      res,
      rows.map((row) => ({
        ...row,
        user_count: Number(row.user_count || 0),
      }))
    );
  });

  app.patch('/api/v1/admin/companies/:id/status', authMiddleware, requireGlobalAdmin, async (req: Request, res: Response) => {
    const schema = z.object({ is_active: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, 400, 'invalid_payload', 'Invalid payload', parsed.error.flatten());
      return;
    }

    const rows = await query<{ id: string; is_active: boolean }>(
      'update companies set is_active = $1 where id = $2 returning id, is_active',
      [parsed.data.is_active, req.params.id]
    );

    if (!rows[0]) {
      fail(res, 404, 'company_not_found', 'Company not found');
      return;
    }

    await query(
      `insert into activity_logs (company_id, user_id, action, metadata)
       values ($1,$2,$3,$4::jsonb)`,
      [
        req.params.id,
        req.authUser?.id || null,
        parsed.data.is_active ? 'company.activated' : 'company.deactivated',
        JSON.stringify({ by: req.authUser?.id || null }),
      ]
    );

    ok(res, rows[0]);
  });

  app.get('/api/v1/admin/companies/:id/users', authMiddleware, requireGlobalAdmin, async (req: Request, res: Response) => {
    const rows = await query<{
      id: string;
      role: string;
      email: string;
      full_name: string | null;
      created_at: string;
    }>(
      `
      select id, role, email, full_name, created_at
      from users
      where company_id = $1
      order by created_at asc
      `,
      [req.params.id]
    );

    ok(res, rows);
  });

  app.use('/api', (_req: Request, res: Response) => {
    fail(res, 404, 'not_found', 'Endpoint not found');
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    fail(res, 500, 'internal_error', 'Unexpected server error', (error as Error).message);
  });
}
