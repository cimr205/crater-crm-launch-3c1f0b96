import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env';
import { query } from './database';
import { fail } from './http';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string | null;
  companyId: string;
  companyName: string;
  companyIsActive: boolean;
  role: string;
  isGlobalAdmin: boolean;
  permissions: string[];
};

const jwks = env.supabaseUrl
  ? createRemoteJWKSet(new URL(`${env.supabaseUrl}/auth/v1/.well-known/jwks.json`))
  : null;

async function verifySupabaseToken(token: string) {
  if (!jwks || !env.supabaseJwtIssuer) {
    throw new Error('Supabase JWT configuration is missing');
  }
  const { payload } = await jwtVerify(token, jwks, {
    issuer: env.supabaseJwtIssuer,
    audience: 'authenticated',
  });
  if (!payload.sub) {
    throw new Error('Invalid token payload');
  }
  return payload.sub;
}

async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const rows = await query<{
    id: string;
    email: string;
    full_name: string | null;
    company_id: string;
    company_name: string;
    company_is_active: boolean;
    role: string;
    is_global_admin: boolean;
    permissions: string[] | null;
  }>(
    `
    select
      u.id,
      u.email,
      u.full_name,
      u.company_id,
      c.name as company_name,
      c.is_active as company_is_active,
      u.role,
      u.is_global_admin,
      coalesce(array_agg(rp.permission) filter (where rp.permission is not null), '{}') as permissions
    from users u
    join companies c on c.id = u.company_id
    left join role_permissions rp on rp.role_slug = u.role
    where u.id = $1
    group by u.id, c.name, c.is_active
    `,
    [userId]
  );

  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    email: rows[0].email,
    fullName: rows[0].full_name,
    companyId: rows[0].company_id,
    companyName: rows[0].company_name,
    companyIsActive: rows[0].company_is_active,
    role: rows[0].role,
    isGlobalAdmin: rows[0].is_global_admin,
    permissions: rows[0].permissions || [],
  };
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (!token) {
    fail(res, 401, 'unauthorized', 'Missing bearer token');
    return;
  }

  try {
    const userId = await verifySupabaseToken(token);
    const user = await loadAuthUser(userId);
    if (!user) {
      fail(res, 401, 'unauthorized', 'No application profile found for this user');
      return;
    }
    if (!user.companyIsActive && !user.isGlobalAdmin) {
      fail(res, 403, 'company_inactive', 'Company is inactive. Contact support.');
      return;
    }

    req.authUser = user;
    next();
  } catch (error) {
    fail(res, 401, 'unauthorized', 'Invalid or expired token', (error as Error).message);
  }
}

export function requireGlobalAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    fail(res, 401, 'unauthorized', 'Authentication required');
    return;
  }
  if (!req.authUser.isGlobalAdmin) {
    fail(res, 403, 'forbidden', 'Global admin role required');
    return;
  }
  next();
}

export function hasPermission(user: AuthUser, permission: string) {
  if (user.isGlobalAdmin) return true;
  if (user.permissions.includes('*')) return true;
  return user.permissions.includes(permission);
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      fail(res, 401, 'unauthorized', 'Authentication required');
      return;
    }
    if (!hasPermission(req.authUser, permission)) {
      fail(res, 403, 'forbidden', `Permission required: ${permission}`);
      return;
    }
    next();
  };
}
