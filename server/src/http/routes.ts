import { randomUUID } from 'crypto';
import type { Application, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { parse } from 'csv-parse/sync';
import xlsx from 'xlsx';
import { requireAdmin, requireAuth } from './middleware';
import { hashPassword, verifyPassword, createSession } from '../auth';
import { createUser, findUserByEmail, markUserEmailVerified, updateUser } from '../repositories/userRepository';
import {
  createEmailVerification,
  deleteEmailVerification,
  findEmailVerification,
} from '../repositories/emailVerificationRepository';
import { createLead, listLeadsByOwner, updateLeadScore } from '../repositories/leadRepository';
import { createDeal, listDealsByOwner, summarizePipeline, updateDealStage } from '../repositories/dealRepository';
import { TaskRepositorySqlite } from '../repositories/taskRepository';
import { TaskService } from '../services/tasks/taskService';
import { scoreLead } from '../services/leadScoring';
import { EmailService } from '../services/email/emailService';
import {
  createCompany,
  findCompanyByJoinCode,
  listCompaniesWithCounts,
  updateCompanySettings,
} from '../repositories/companyRepository';
import { readStore } from '../db';
import { listTodosByOwner, updateTodoStatus } from '../repositories/todoRepository';
import {
  createInvitation,
  deleteInvitation,
  findInvitationByToken,
  findInvitationByEmail,
  listInvitationsByCompany,
} from '../repositories/invitationRepository';
import { sendMessage, listMessagesForUser, markMessageRead } from '../repositories/messageRepository';
import {
  createNotification,
  listNotificationsForUser,
  markNotificationRead,
} from '../repositories/notificationRepository';
import {
  createCalendarEvent,
  listCalendarEventsForCompany,
  listCalendarEventsForUser,
} from '../repositories/calendarRepository';
import { createOAuthState, deleteOAuthState, findOAuthState } from '../repositories/oauthStateRepository';
import { metaConfig } from '../meta-ads-ai/config';
import { env } from '../config/env';
import { buildMetaAuthUrl, exchangeLongLivedToken, exchangeMetaCode } from '../meta-ads-ai/meta/oauth';
import { metaGet } from '../meta-ads-ai/meta/apiClient';
import { createMetaOAuthState, deleteMetaOAuthState, findMetaOAuthState } from '../meta-ads-ai/tenancy/metaOAuthStateRepository';
import { getMetaConnection, removeMetaConnection, upsertMetaConnection } from '../meta-ads-ai/tenancy/metaConnectionRepository';
import { registerMetaAdsMcpRoutes } from '../meta-ads-mcp';
import { ensureAiActionConfig, listAiActions, upsertAiActionConfig } from '../repositories/aiActionRepository';
import {
  ensureTenantIntegration,
  findTenantIntegrationByKey,
  logWebsiteEvent,
  updateTenantIntegration,
} from '../repositories/tenantIntegrationRepository';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const pipelineStages = [
  { id: 'new_lead', name: 'New lead', order: 1 },
  { id: 'contacted', name: 'Contacted', order: 2 },
  { id: 'meeting_booked', name: 'Meeting booked', order: 3 },
  { id: 'proposal_sent', name: 'Proposal sent', order: 4 },
  { id: 'negotiation', name: 'Negotiation', order: 5 },
  { id: 'won', name: 'Won', order: 6 },
  { id: 'lost', name: 'Lost', order: 7 },
] as const;

const stageIdSchema = z.enum([
  'new_lead',
  'contacted',
  'meeting_booked',
  'proposal_sent',
  'negotiation',
  'won',
  'lost',
]);

type WorkHistoryItem = {
  id: string;
  type: 'todo' | 'task' | 'campaign';
  title: string;
  status: string;
  category?: string;
  source?: string;
  completedAt?: string;
};

function resolveMonthPrefix(month?: string) {
  return month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
}

function buildHistoryItems(input: {
  monthPrefix: string;
  userId?: string;
  companyId?: string;
}) {
  const store = readStore();
  let todos = store.todos as typeof store.todos;
  let tasks = store.tasks as typeof store.tasks;
  let campaigns = store.campaigns as typeof store.campaigns;

  if (input.userId) {
    todos = todos.filter((todo) => todo.ownerUserId === input.userId);
    tasks = tasks.filter((task) => task.ownerUserId === input.userId);
    campaigns = campaigns.filter((campaign) => campaign.ownerUserId === input.userId);
  }

  if (input.companyId) {
    const companyUsers = new Set(store.users.filter((u) => u.companyId === input.companyId).map((u) => u.id));
    todos = todos.filter((todo) => todo.companyId === input.companyId || companyUsers.has(todo.ownerUserId));
    tasks = tasks.filter((task) => companyUsers.has(task.ownerUserId));
    campaigns = campaigns.filter((campaign) => campaign.companyId === input.companyId);
  }

  const todoItems: WorkHistoryItem[] = todos
    .filter((todo) => todo.status === 'done' && todo.updatedAt.startsWith(input.monthPrefix))
    .map((todo) => ({
      id: todo.id,
      type: 'todo',
      title: todo.title,
      status: todo.status,
      category: todo.actionType || todo.recommendedAction,
      source: todo.source,
      completedAt: todo.updatedAt,
    }));

  const taskItems: WorkHistoryItem[] = tasks
    .filter((task) => task.status === 'done' && task.completedAt?.startsWith(input.monthPrefix))
    .map((task) => ({
      id: task.id,
      type: 'task',
      title: task.title,
      status: task.status,
      category: task.type,
      source: 'task',
      completedAt: task.completedAt,
    }));

  const campaignItems: WorkHistoryItem[] = campaigns
    .filter((campaign) => campaign.status === 'sent' && campaign.updatedAt.startsWith(input.monthPrefix))
    .map((campaign) => ({
      id: campaign.id,
      type: 'campaign',
      title: `Campaign: ${campaign.name}`,
      status: campaign.status,
      category: 'campaign',
      source: 'campaign',
      completedAt: campaign.updatedAt,
    }));

  return [...todoItems, ...taskItems, ...campaignItems];
}

function summarizeHistory(items: WorkHistoryItem[]) {
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    const key = item.category || 'uncategorized';
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function csvEscape(value: string | undefined) {
  const text = value ?? '';
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateJoinCode() {
  const pick = () => JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
  return `${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}`;
}

function generateUniqueJoinCode() {
  const store = readStore();
  let code = generateJoinCode();
  let attempts = 0;
  while (store.companies.some((company) => company.joinCode.toLowerCase() === code.toLowerCase())) {
    code = generateJoinCode();
    attempts += 1;
    if (attempts > 20) {
      code = `${generateJoinCode()}-${Math.floor(Math.random() * 9)}`;
      break;
    }
  }
  return code;
}

function isOriginAllowed(origin: string | undefined, domains: string[]) {
  if (!origin) return false;
  if (!domains.length) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function registerRoutes(app: Application, deps: { email: EmailService }) {
  const taskRepo = new TaskRepositorySqlite();
  const taskService = new TaskService(taskRepo);

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const schema = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email(),
      password: z.string().min(8),
      company_name: z.string().min(2).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const existing = findUserByEmail(parsed.data.email);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const userId = randomUUID();
    let companyId: string | undefined;
    if (parsed.data.company_name) {
      const company = createCompany({
        name: parsed.data.company_name,
        ownerUserId: userId,
        joinCode: generateUniqueJoinCode(),
        defaultLanguage: 'en',
        defaultTheme: 'light',
      });
      companyId = company.id;
    }
    const passwordHash = await hashPassword(parsed.data.password);
    createUser({
      id: userId,
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.company_name ? 'admin' : 'user',
      companyId,
    });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    createEmailVerification({ id: randomUUID(), userId, token, expiresAt });

    res.status(201).json({
      user_id: userId,
      company_id: companyId,
      verification_required: true,
      verification_token: token,
    });
  });

  app.post('/api/auth/register-company', async (req: Request, res: Response) => {
    const schema = z.object({
      company_name: z.string().min(2),
      admin_name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8),
      language: z.string().min(2),
      theme: z.enum(['light', 'dark']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const existing = findUserByEmail(parsed.data.email);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const joinCode = generateUniqueJoinCode();
    const userId = randomUUID();
    const company = createCompany({
      name: parsed.data.company_name,
      ownerUserId: userId,
      joinCode,
      defaultLanguage: parsed.data.language,
      defaultTheme: parsed.data.theme,
    });

    const passwordHash = await hashPassword(parsed.data.password);
    createUser({
      id: userId,
      name: parsed.data.admin_name,
      email: parsed.data.email,
      passwordHash,
      role: 'admin',
      companyId: company.id,
      emailVerifiedAt: new Date().toISOString(),
    });

    res.status(201).json({
      tenant: {
        id: company.id,
        name: company.name,
        join_code: company.joinCode,
        default_language: company.defaultLanguage,
        default_theme: company.defaultTheme,
      },
      user: {
        id: userId,
        name: parsed.data.admin_name,
        email: parsed.data.email,
        role: 'admin',
        company_id: company.id,
      },
    });
  });

  app.post('/api/auth/join-company', async (req: Request, res: Response) => {
    const schema = z.object({
      join_code: z.string().min(3),
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const company = findCompanyByJoinCode(parsed.data.join_code);
    if (!company) {
      res.status(404).json({ error: 'Invalid join code' });
      return;
    }

    const existing = findUserByEmail(parsed.data.email);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const userId = randomUUID();
    const passwordHash = await hashPassword(parsed.data.password);
    createUser({
      id: userId,
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: 'user',
      companyId: company.id,
      emailVerifiedAt: new Date().toISOString(),
    });

    res.status(201).json({
      tenant: {
        id: company.id,
        name: company.name,
        join_code: company.joinCode,
        default_language: company.defaultLanguage,
        default_theme: company.defaultTheme,
      },
      user: {
        id: userId,
        name: parsed.data.name,
        email: parsed.data.email,
        role: 'user',
        company_id: company.id,
      },
    });
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const user = findUserByEmail(parsed.data.email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const session = createSession(user.id);
    res.status(200).json({
      token: session.id,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        email_verified: Boolean(user.emailVerifiedAt),
        role: user.role,
        company_id: user.companyId,
      },
    });
  });

  app.post('/api/auth/verify-email', (req: Request, res: Response) => {
    const schema = z.object({ token: z.string().min(10) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const verification = findEmailVerification(parsed.data.token);
    if (!verification) {
      res.status(400).json({ error: 'Invalid or expired token' });
      return;
    }

    const verifiedAt = markUserEmailVerified(verification.userId);
    deleteEmailVerification(verification.id);
    res.status(200).json({ status: 'verified', verified_at: verifiedAt });
  });

  app.get('/api/auth/google/start', (req: Request, res: Response) => {
    const clientId = env.googleClientId;
    const redirectUri = env.googleRedirectUri;
    if (!clientId || !redirectUri) {
      res.status(400).json({ error: 'Google OAuth is not configured' });
      return;
    }
    const inviteToken = typeof req.query.invite_token === 'string' ? req.query.invite_token : undefined;
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();
    const stateRecord = createOAuthState({ inviteToken, expiresAt });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: stateRecord.state,
      access_type: 'offline',
      prompt: 'consent',
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.status(200).json({ auth_url: authUrl, state: stateRecord.state });
  });

  app.post('/api/auth/google/callback', async (req: Request, res: Response) => {
    const schema = z.object({
      code: z.string().min(4),
      state: z.string().min(8),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    const clientId = env.googleClientId;
    const clientSecret = env.googleClientSecret;
    const redirectUri = env.googleRedirectUri;
    if (!clientId || !clientSecret || !redirectUri) {
      res.status(400).json({ error: 'Google OAuth is not configured' });
      return;
    }

    const stateRecord = findOAuthState(parsed.data.state);
    if (!stateRecord || stateRecord.expiresAt < new Date().toISOString()) {
      res.status(400).json({ error: 'Invalid or expired state' });
      return;
    }

    const tokenParams = new URLSearchParams({
      code: parsed.data.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams,
    });
    if (!tokenResponse.ok) {
      res.status(400).json({ error: 'Google token exchange failed' });
      return;
    }
    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      res.status(400).json({ error: 'Missing access token' });
      return;
    }

    const userinfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userinfoResponse.ok) {
      res.status(400).json({ error: 'Google userinfo failed' });
      return;
    }
    const userinfo = (await userinfoResponse.json()) as { email?: string; name?: string };
    if (!userinfo.email) {
      res.status(400).json({ error: 'Google account has no email' });
      return;
    }

    const now = new Date().toISOString();
    let user = findUserByEmail(userinfo.email);
    let companyId: string | undefined;
    let role: 'admin' | 'user' = 'user';

    const invitation = stateRecord.inviteToken
      ? findInvitationByToken(stateRecord.inviteToken)
      : findInvitationByEmail(userinfo.email);

    if (invitation && invitation.expiresAt >= now) {
      companyId = invitation.companyId;
      role = invitation.role;
    }

    if (!user) {
      createUser({
        id: randomUUID(),
        name: userinfo.name,
        email: userinfo.email,
        passwordHash: await hashPassword(randomUUID()),
        role,
        companyId,
        emailVerifiedAt: now,
      });
      user = findUserByEmail(userinfo.email);
    } else {
      updateUser(user.id, {
        name: user.name || userinfo.name,
        emailVerifiedAt: user.emailVerifiedAt || now,
        companyId: user.companyId || companyId,
        role: user.role || role,
      });
    }

    if (invitation) {
      deleteInvitation(invitation.id);
    }
    deleteOAuthState(stateRecord.id);

    const session = createSession(user!.id);
    res.status(200).json({
      token: session.id,
      user: {
        id: user!.id,
        name: user!.name,
        email: user!.email,
        email_verified: true,
        role: user!.role,
        company_id: user!.companyId,
      },
    });
  });

  app.get('/api/meta/connect', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!user.companyId) {
      res.status(400).json({ error: 'User has no company' });
      return;
    }
    if (!metaConfig.appId || !metaConfig.redirectUri || !metaConfig.appSecret) {
      res.status(400).json({ error: 'Meta OAuth is not configured' });
      return;
    }
    if (!metaConfig.tokenEncryptionKey) {
      res.status(400).json({ error: 'Meta token encryption key is not configured' });
      return;
    }
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();
    const state = createMetaOAuthState(user.companyId, expiresAt);
    const authUrl = buildMetaAuthUrl(state.state);
    res.status(200).json({ auth_url: authUrl, state: state.state });
  });

  app.get('/api/meta/callback', async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    if (!code || !state) {
      res.status(400).json({ error: 'Missing code or state' });
      return;
    }

    const stateRecord = findMetaOAuthState(state);
    if (!stateRecord || stateRecord.expiresAt < new Date().toISOString()) {
      res.status(400).json({ error: 'Invalid or expired state' });
      return;
    }

    try {
      const shortLived = await exchangeMetaCode(code);
      const longLived = await exchangeLongLivedToken(shortLived.access_token);
      const expiresAt = new Date(Date.now() + longLived.expires_in * 1000).toISOString();

      const adAccounts = await metaGet<{ data: Array<{ account_id: string }> }>(
        'me/adaccounts',
        longLived.access_token,
        { fields: 'account_id' }
      );
      const businesses = await metaGet<{ data: Array<{ id: string }> }>(
        'me/businesses',
        longLived.access_token,
        { fields: 'id' }
      );

      const adAccountId = adAccounts.data?.[0]?.account_id || '';
      const businessId = businesses.data?.[0]?.id || '';
      if (!adAccountId || !businessId) {
        res.status(400).json({ error: 'Missing ad account or business ID' });
        return;
      }

      upsertMetaConnection({
        companyId: stateRecord.companyId,
        accessToken: longLived.access_token,
        adAccountId,
        businessId,
        tokenExpiresAt: expiresAt,
      });
      deleteMetaOAuthState(stateRecord.id);
      res.status(200).json({
        status: 'connected',
        meta_ad_account_id: adAccountId,
        meta_business_id: businessId,
        token_expires_at: expiresAt,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message || 'Meta callback failed' });
    }
  });

  app.get('/api/meta/status', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!user.companyId) {
      res.status(400).json({ error: 'User has no company' });
      return;
    }
    const connection = getMetaConnection(user.companyId);
    if (!connection) {
      res.status(200).json({ connected: false });
      return;
    }
    res.status(200).json({
      connected: true,
      meta_ad_account_id: connection.metaAdAccountId,
      meta_business_id: connection.metaBusinessId,
      token_expires_at: connection.tokenExpiresAt,
    });
  });

  app.post('/api/meta/disconnect', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!user.companyId) {
      res.status(400).json({ error: 'User has no company' });
      return;
    }
    removeMetaConnection(user.companyId);
    res.status(200).json({ status: 'disconnected' });
  });

  app.post('/api/meta/insights', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!user.companyId) {
      res.status(400).json({ error: 'User has no company' });
      return;
    }
    const connection = getMetaConnection(user.companyId);
    if (!connection) {
      res.status(400).json({ error: 'Meta not connected' });
      return;
    }
    const fields = typeof req.body?.fields === 'string' ? req.body.fields : 'spend,cpa,conversions,impressions,ctr,frequency';
    const response = await metaGet(
      `act_${connection.metaAdAccountId}/insights`,
      connection.metaAccessToken,
      { fields }
    );
    res.status(200).json(response);
  });

  app.patch('/api/company/settings', (req: Request, res: Response) => {
    const user = requireAdmin(req, res);
    if (!user) return;
    if (!user.companyId) {
      res.status(400).json({ error: 'User has no company' });
      return;
    }

    const schema = z.object({
      language: z.string().min(2).optional(),
      theme: z.enum(['light', 'dark']).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const updated = updateCompanySettings(user.companyId, {
      defaultLanguage: parsed.data.language,
      defaultTheme: parsed.data.theme,
    });
    if (!updated) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    res.status(200).json({
      tenant: {
        id: updated.id,
        name: updated.name,
        join_code: updated.joinCode,
        default_language: updated.defaultLanguage,
        default_theme: updated.defaultTheme,
      },
    });
  });

  app.get('/api/ai/actions', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.status(200).json({ data: listAiActions() });
  });

  app.get('/api/ai/settings', (req: Request, res: Response) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (!admin.companyId) {
      res.status(400).json({ error: 'Admin has no company' });
      return;
    }
    const config = ensureAiActionConfig(admin.companyId);
    res.status(200).json({ data: config });
  });

  app.patch('/api/ai/settings', (req: Request, res: Response) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (!admin.companyId) {
      res.status(400).json({ error: 'Admin has no company' });
      return;
    }
    const schema = z.object({
      enabled_actions: z.array(z.string()).optional(),
      tone_of_voice: z.string().min(2).optional(),
      auto_send_mode: z.enum(['draft', 'auto']).optional(),
      booking_window_start: z.string().min(4).optional(),
      booking_window_end: z.string().min(4).optional(),
      booking_timezone: z.string().min(3).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    const updated = upsertAiActionConfig(admin.companyId, {
      enabledActions: parsed.data.enabled_actions,
      toneOfVoice: parsed.data.tone_of_voice,
      autoSendMode: parsed.data.auto_send_mode,
      bookingWindowStart: parsed.data.booking_window_start,
      bookingWindowEnd: parsed.data.booking_window_end,
      bookingTimezone: parsed.data.booking_timezone,
    });
    res.status(200).json({ data: updated });
  });

  app.get('/api/tenant/integrations', (req: Request, res: Response) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (!admin.companyId) {
      res.status(400).json({ error: 'Admin has no company' });
      return;
    }

    const integration = ensureTenantIntegration(admin.companyId);
    const metaConnection = getMetaConnection(admin.companyId);
    res.status(200).json({
      metaConnected: Boolean(metaConnection),
      metaAdAccountId: metaConnection?.metaAdAccountId || null,
      metaBusinessId: metaConnection?.metaBusinessId || null,
      metaTokenExpiresAt: metaConnection?.tokenExpiresAt || null,
      websiteTrackingKey: integration.websiteTrackingKey,
      websiteDomains: integration.websiteDomains || [],
      metaPixelId: integration.metaPixelId || null,
      metaCapiTokenSet: Boolean(integration.metaCapiToken),
    });
  });

  app.patch('/api/tenant/integrations', (req: Request, res: Response) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (!admin.companyId) {
      res.status(400).json({ error: 'Admin has no company' });
      return;
    }

    const schema = z.object({
      website_domains: z.array(z.string()).optional(),
      meta_pixel_id: z.string().min(3).optional().nullable(),
      meta_capi_token: z.string().min(5).optional().nullable(),
      rotate_tracking_key: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const updated = updateTenantIntegration(admin.companyId, {
      websiteDomains: parsed.data.website_domains,
      metaPixelId: parsed.data.meta_pixel_id,
      metaCapiToken: parsed.data.meta_capi_token,
      rotateKey: parsed.data.rotate_tracking_key,
    });

    res.status(200).json({
      websiteTrackingKey: updated.websiteTrackingKey,
      websiteDomains: updated.websiteDomains,
      metaPixelId: updated.metaPixelId || null,
      metaCapiTokenSet: Boolean(updated.metaCapiToken),
    });
  });

  app.options('/api/track', (_req: Request, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send();
  });

  app.post('/api/track', (req: Request, res: Response) => {
    const schema = z.object({
      key: z.string().min(10),
      event: z.string().min(2),
      url: z.string().optional(),
      referrer: z.string().optional(),
      payload: z.record(z.unknown()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const integration = findTenantIntegrationByKey(parsed.data.key);
    if (!integration) {
      res.status(401).json({ error: 'Invalid tracking key' });
      return;
    }

    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    if (!isOriginAllowed(origin, integration.websiteDomains)) {
      res.status(403).json({ error: 'Origin not allowed' });
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');

    logWebsiteEvent({
      companyId: integration.companyId,
      eventName: parsed.data.event,
      url: parsed.data.url,
      referrer: parsed.data.referrer,
      payload: parsed.data.payload,
    });

    res.status(200).json({ ok: true });
  });

  app.post('/api/admin/bootstrap', async (req: Request, res: Response) => {
    const schema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8),
      company_name: z.string().min(2),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const store = readStore();
    if (store.users.length > 0) {
      res.status(409).json({ error: 'Bootstrap already completed' });
      return;
    }

    const userId = randomUUID();
    const company = createCompany({ name: parsed.data.company_name, ownerUserId: userId });
    const passwordHash = await hashPassword(parsed.data.password);
    createUser({
      id: userId,
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: 'admin',
      companyId: company.id,
    });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    createEmailVerification({ id: randomUUID(), userId, token, expiresAt });

    res.status(201).json({
      user_id: userId,
      company_id: company.id,
      verification_required: true,
      verification_token: token,
    });
  });

  app.get('/api/admin/overview', (req: Request, res: Response) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const companies = listCompaniesWithCounts();
    const store = readStore();
    const users = store.users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company_id: user.companyId,
      created_at: user.createdAt,
      email_verified: Boolean(user.emailVerifiedAt),
    }));
    res.status(200).json({ companies, users });
  });

  app.get('/api/admin/companies/history/export', (req: Request, res: Response) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const monthPrefix = resolveMonthPrefix(month);
    const store = readStore();
    const header = [
      'company_id',
      'company_name',
      'id',
      'type',
      'title',
      'status',
      'category',
      'source',
      'completed_at',
    ];
    const rows = store.companies.flatMap((company) => {
      const items = buildHistoryItems({ monthPrefix, companyId: company.id });
      return items.map((item) =>
        [
          csvEscape(company.id),
          csvEscape(company.name),
          csvEscape(item.id),
          csvEscape(item.type),
          csvEscape(item.title),
          csvEscape(item.status),
          csvEscape(item.category),
          csvEscape(item.source),
          csvEscape(item.completedAt),
        ].join(',')
      );
    });
    const csv = [header.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="all-companies-history-${monthPrefix}.csv"`);
    res.status(200).send(csv);
  });

  app.get('/api/admin/companies/:id/users', (req: Request, res: Response) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const companyId = req.params.id;
    if (admin.companyId !== companyId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const store = readStore();
    const users = store.users
      .filter((user) => user.companyId === companyId)
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.createdAt,
        email_verified: Boolean(user.emailVerifiedAt),
      }));
    res.status(200).json({ data: users });
  });

  app.get('/api/admin/companies/:id/metrics', (req: Request, res: Response) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const companyId = req.params.id;
    if (admin.companyId !== companyId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const store = readStore();
    const users = store.users.filter((user) => user.companyId === companyId);
    const userIds = new Set(users.map((user) => user.id));
    const leadCount = store.leads.filter((lead) => userIds.has(lead.ownerUserId)).length;
    const dealCount = store.deals.filter((deal) => userIds.has(deal.ownerUserId)).length;
    const taskCount = store.tasks.filter((task) => userIds.has(task.ownerUserId)).length;
    res.status(200).json({
      company_id: companyId,
      totals: {
        users: users.length,
        leads: leadCount,
        deals: dealCount,
        tasks: taskCount,
      },
    });
  });

  app.post('/api/admin/invitations', async (req: Request, res: Response) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (!admin.companyId) {
      res.status(400).json({ error: 'Admin has no company' });
      return;
    }
    const schema = z.object({
      email: z.string().email(),
      role: z.enum(['admin', 'user']).default('user'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    const invite = createInvitation({
      companyId: admin.companyId,
      email: parsed.data.email,
      role: parsed.data.role,
      expiresAt,
    });
    res.status(201).json({
      invitation_id: invite.id,
      token: invite.token,
      expires_at: invite.expiresAt,
    });
  });

  app.get('/api/admin/invitations', (req: Request, res: Response) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (!admin.companyId) {
      res.status(400).json({ error: 'Admin has no company' });
      return;
    }
    const invites = listInvitationsByCompany(admin.companyId);
    res.status(200).json({ data: invites });
  });

  app.post('/api/invitations/accept', async (req: Request, res: Response) => {
    const schema = z.object({
      token: z.string().min(10),
      name: z.string().min(2),
      password: z.string().min(8),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    const invite = findInvitationByToken(parsed.data.token);
    if (!invite || invite.expiresAt < new Date().toISOString()) {
      res.status(400).json({ error: 'Invalid or expired invitation' });
      return;
    }
    const existing = findUserByEmail(invite.email);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    const userId = randomUUID();
    const passwordHash = await hashPassword(parsed.data.password);
    createUser({
      id: userId,
      name: parsed.data.name,
      email: invite.email,
      passwordHash,
      role: invite.role,
      companyId: invite.companyId,
    });
    deleteInvitation(invite.id);
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    createEmailVerification({ id: randomUUID(), userId, token, expiresAt });
    res.status(201).json({ user_id: userId, verification_token: token });
  });

  app.post('/api/email/send', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const schema = z.object({
      account_id: z.string().min(3),
      to: z.array(z.string().email()).min(1),
      subject: z.string().min(2),
      body: z.string().min(1),
      lead_id: z.string().optional(),
      customer_id: z.string().optional(),
      deal_id: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const result = await deps.email.sendEmail({
      ownerUserId: user.id,
      accountId: parsed.data.account_id,
      to: parsed.data.to,
      subject: parsed.data.subject,
      body: parsed.data.body,
      leadId: parsed.data.lead_id,
      customerId: parsed.data.customer_id,
      dealId: parsed.data.deal_id,
    });

    res.status(201).json({ message_id: result.messageId });
  });

  app.post('/api/email/sync', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const schema = z.object({ account_id: z.string().min(3) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    const result = await deps.email.syncInbound(parsed.data.account_id);
    res.status(200).json(result);
  });

  app.post('/api/leads', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const schema = z.object({
      name: z.string().min(2),
      phone: z.string().min(6),
      email: z.string().email().optional(),
      company: z.string().optional(),
      status: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const lead = createLead({
      id: randomUUID(),
      ownerUserId: user.id,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      company: parsed.data.company,
      status: parsed.data.status || 'cold',
    });

    if (user.companyId) {
      createNotification({
        companyId: user.companyId,
        userId: user.id,
        title: 'New lead created',
        body: `${lead.name} (${lead.company || 'n/a'})`,
      });
    }

    res.status(201).json({ data: lead });
  });

  app.get('/api/leads', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const leads = listLeadsByOwner(user.id);
    res.status(200).json({ data: leads });
  });

  app.post('/api/leads/import', upload.single('file'), (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    if (!req.file) {
      res.status(400).json({ error: 'File required' });
      return;
    }

    const extension = req.file.originalname.split('.').pop()?.toLowerCase();
    const rows: Record<string, string>[] = [];

    if (extension === 'csv') {
      const text = req.file.buffer.toString('utf-8');
      const records = parse(text, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
      rows.push(...records);
    } else if (extension === 'xlsx') {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const records = xlsx.utils.sheet_to_json<Record<string, string>>(sheet);
      rows.push(...records);
    } else {
      res.status(400).json({ error: 'Unsupported file type' });
      return;
    }

    const created = rows
      .map((row) => {
        const normalized = Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key.toLowerCase().trim(), value])
        );
        const name = String(normalized.name || normalized.full_name || '').trim();
        const phone = String(normalized.phone || normalized.phone_number || '').trim();
        const email = normalized.email ? String(normalized.email).trim() : undefined;
        const company = normalized.company ? String(normalized.company).trim() : undefined;
        if (!name || !phone) return null;
        return createLead({
          id: randomUUID(),
          ownerUserId: user.id,
          name,
          phone,
          email,
          company,
          status: 'cold',
        });
      })
      .filter(Boolean);

    res.status(201).json({ imported: created.length });
  });

  app.patch('/api/leads/:id/score', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const schema = z.object({
      score: z.number().min(1).max(10).optional(),
      outcome: z.string().optional(),
      sentiment: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      engagement_score: z.number().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const score = typeof parsed.data.score === 'number'
      ? parsed.data.score
      : scoreLead({
          outcome: parsed.data.outcome,
          sentiment: parsed.data.sentiment,
          keywords: parsed.data.keywords,
          engagementScore: parsed.data.engagement_score,
        });

    updateLeadScore(req.params.id, score);
    res.status(200).json({ lead_id: req.params.id, score });
  });

  app.post('/api/deals', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const schema = z.object({
      title: z.string().min(2),
      value: z.number().min(0),
      stage_id: stageIdSchema,
      employee_id: z.string().optional(),
      lead_id: z.string().optional(),
      customer_id: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const deal = createDeal({
      ownerUserId: user.id,
      title: parsed.data.title,
      value: parsed.data.value,
      stageId: parsed.data.stage_id as typeof pipelineStages[number]['id'],
      employeeId: parsed.data.employee_id,
      leadId: parsed.data.lead_id,
      customerId: parsed.data.customer_id,
    });

    if (user.companyId) {
      createNotification({
        companyId: user.companyId,
        userId: user.id,
        title: 'New deal created',
        body: `${deal.title} (${deal.value})`,
      });
    }

    res.status(201).json({ data: deal });
  });

  app.get('/api/deals', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const deals = listDealsByOwner(user.id);
    res.status(200).json({ data: deals });
  });

  app.patch('/api/deals/:id/stage', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const schema = z.object({ stage_id: stageIdSchema });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    const result = updateDealStage({ id: req.params.id, stageId: parsed.data.stage_id as typeof pipelineStages[number]['id'] });
    res.status(200).json({ updated_at: result.updatedAt, stage_entered_at: result.stageEnteredAt });
  });

  app.get('/api/pipeline/stages', (_req: Request, res: Response) => {
    res.status(200).json({ data: pipelineStages });
  });

  app.get('/api/pipeline/summary', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const summary: ReturnType<typeof summarizePipeline> = summarizePipeline(user.id);
    const byStage = new Map(summary.map((row) => [row.stageId, row] as const));
    const data = pipelineStages.map((stage) => ({
      stageId: stage.id,
      count: byStage.get(stage.id)?.count || 0,
      totalValue: byStage.get(stage.id)?.totalValue || 0,
    }));
    res.status(200).json({ data });
  });

  app.post('/api/tasks', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const schema = z.object({
      type: z.string().min(2),
      title: z.string().min(2),
      due_at: z.string().min(10),
      lead_id: z.string().optional(),
      customer_id: z.string().optional(),
      deal_id: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const task = await taskService.createTask({
      type: parsed.data.type as 'Svar på tilbud' | 'Følg op' | 'Ring tilbage' | 'Send kontrakt',
      title: parsed.data.title,
      dueAt: parsed.data.due_at,
      ownerUserId: user.id,
      related: {
        leadId: parsed.data.lead_id,
        customerId: parsed.data.customer_id,
        dealId: parsed.data.deal_id,
      },
    });

    if (user.companyId) {
      createNotification({
        companyId: user.companyId,
        userId: user.id,
        title: 'New task created',
        body: task.title,
      });
    }

    res.status(201).json({ data: task });
  });

  app.get('/api/tasks', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const tasks = await taskRepo.listByOwner(user.id, status as 'open' | 'done' | 'overdue' | undefined);
    res.status(200).json({ data: tasks });
  });

  app.patch('/api/tasks/:id', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const schema = z.object({ status: z.enum(['open', 'done', 'overdue']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    const updated = await taskService.markStatus(req.params.id, parsed.data.status);
    res.status(200).json({ data: updated });
  });

  app.get('/api/todos', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const todos = listTodosByOwner(user.id);
    res.status(200).json({ data: todos });
  });

  app.patch('/api/todos/:id', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const schema = z.object({ status: z.enum(['open', 'done', 'overdue']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    const updated = updateTodoStatus(req.params.id, { status: parsed.data.status });
    if (!updated) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }
    res.status(200).json({ data: updated });
  });

  app.get('/api/work-items', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const store = readStore();
    const todos = listTodosByOwner(user.id).map((todo) => ({
      id: todo.id,
      type: 'todo',
      title: todo.title,
      status: todo.status,
      priorityBucket: todo.priorityBucket,
      recommendedAction: todo.recommendedAction,
      source: todo.source,
      dueAt: todo.dueAt,
      createdAt: todo.createdAt,
    }));
    const tasks = await taskRepo.listByOwner(user.id).then((rows) =>
      rows.map((task) => ({
        id: task.id,
        type: 'task',
        title: task.title,
        status: task.status,
        priorityBucket: undefined,
        recommendedAction: task.type,
        source: 'task',
        dueAt: task.dueAt,
        createdAt: task.createdAt,
      }))
    );
    const campaigns = store.campaigns
      .filter((campaign) => campaign.ownerUserId === user.id && campaign.status !== 'sent')
      .map((campaign) => ({
        id: campaign.id,
        type: 'campaign',
        title: `Campaign: ${campaign.name}`,
        status: campaign.status,
        priorityBucket: 'next',
        recommendedAction: 'Review campaign',
        source: 'campaign',
        dueAt: campaign.scheduledAt,
        createdAt: campaign.createdAt,
      }));
    res.status(200).json({ data: [...todos, ...tasks, ...campaigns] });
  });

  app.get('/api/work-items/history', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const monthPrefix = resolveMonthPrefix(month);
    const data = buildHistoryItems({ monthPrefix, userId: user.id });
    res.status(200).json({ month: monthPrefix, data });
  });

  app.get('/api/work-items/history/summary', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const monthPrefix = resolveMonthPrefix(month);
    const data = buildHistoryItems({ monthPrefix, userId: user.id });
    res.status(200).json({ month: monthPrefix, totals: summarizeHistory(data) });
  });

  app.get('/api/work-items/history/export', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const monthPrefix = resolveMonthPrefix(month);
    const data = buildHistoryItems({ monthPrefix, userId: user.id });
    const header = ['id', 'type', 'title', 'status', 'category', 'source', 'completed_at'];
    const rows = data.map((item) =>
      [
        csvEscape(item.id),
        csvEscape(item.type),
        csvEscape(item.title),
        csvEscape(item.status),
        csvEscape(item.category),
        csvEscape(item.source),
        csvEscape(item.completedAt),
      ].join(',')
    );
    const csv = [header.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="work-history-${monthPrefix}.csv"`);
    res.status(200).send(csv);
  });

  app.get('/api/company/work-items/history', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!user.companyId) {
      res.status(400).json({ error: 'User has no company' });
      return;
    }
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const monthPrefix = resolveMonthPrefix(month);
    const data = buildHistoryItems({ monthPrefix, companyId: user.companyId });
    res.status(200).json({ month: monthPrefix, data });
  });

  app.get('/api/company/work-items/history/summary', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!user.companyId) {
      res.status(400).json({ error: 'User has no company' });
      return;
    }
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const monthPrefix = resolveMonthPrefix(month);
    const data = buildHistoryItems({ monthPrefix, companyId: user.companyId });
    res.status(200).json({ month: monthPrefix, totals: summarizeHistory(data) });
  });

  app.get('/api/company/work-items/history/users', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!user.companyId) {
      res.status(400).json({ error: 'User has no company' });
      return;
    }
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const monthPrefix = resolveMonthPrefix(month);
    const store = readStore();
    const users = store.users
      .filter((item) => item.companyId === user.companyId)
      .map((item) => {
        const items = buildHistoryItems({ monthPrefix, userId: item.id });
        return {
          id: item.id,
          name: item.name,
          email: item.email,
          total: items.length,
          totals: summarizeHistory(items),
        };
      });
    res.status(200).json({ month: monthPrefix, users });
  });

  app.get('/api/company/work-items/history/year', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!user.companyId) {
      res.status(400).json({ error: 'User has no company' });
      return;
    }
    const year =
      typeof req.query.year === 'string' && /^\d{4}$/.test(req.query.year)
        ? req.query.year
        : new Date().getFullYear().toString();
    const months = Array.from({ length: 12 }, (_, idx) => `${year}-${String(idx + 1).padStart(2, '0')}`);
    const data = months.map((monthPrefix) => {
      const items = buildHistoryItems({ monthPrefix, companyId: user.companyId });
      return {
        month: monthPrefix,
        total: items.length,
        totals: summarizeHistory(items),
      };
    });
    res.status(200).json({ year, months: data });
  });

  app.get('/api/company/work-items/history/export', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!user.companyId) {
      res.status(400).json({ error: 'User has no company' });
      return;
    }
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const monthPrefix = resolveMonthPrefix(month);
    const data = buildHistoryItems({ monthPrefix, companyId: user.companyId });
    const header = ['id', 'type', 'title', 'status', 'category', 'source', 'completed_at'];
    const rows = data.map((item) =>
      [
        csvEscape(item.id),
        csvEscape(item.type),
        csvEscape(item.title),
        csvEscape(item.status),
        csvEscape(item.category),
        csvEscape(item.source),
        csvEscape(item.completedAt),
      ].join(',')
    );
    const csv = [header.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="company-history-${monthPrefix}.csv"`);
    res.status(200).send(csv);
  });

  app.get('/api/dashboard', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const leads = listLeadsByOwner(user.id);
    const deals = listDealsByOwner(user.id);
    const tasks = await taskRepo.findOpenByOwner(user.id);
    res.status(200).json({
      totals: {
        leads: leads.length,
        deals: deals.length,
        open_tasks: tasks.length,
      },
    });
  });

  app.post('/api/messages', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!user.companyId) {
      res.status(400).json({ error: 'User has no company' });
      return;
    }
    const schema = z.object({
      recipient_user_id: z.string().min(10),
      subject: z.string().min(2),
      body: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    const store = readStore();
    const recipient = store.users.find(
      (item) => item.id === parsed.data.recipient_user_id && item.companyId === user.companyId
    );
    if (!recipient) {
      res.status(404).json({ error: 'Recipient not found' });
      return;
    }
    const message = sendMessage({
      companyId: user.companyId,
      senderUserId: user.id,
      recipientUserId: parsed.data.recipient_user_id,
      subject: parsed.data.subject,
      body: parsed.data.body,
    });
    res.status(201).json({ data: message });
  });

  app.get('/api/inbox', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!user.companyId) {
      res.status(400).json({ error: 'User has no company' });
      return;
    }
    const messages = listMessagesForUser(user.companyId, user.id);
    const notifications = listNotificationsForUser(user.companyId, user.id);
    res.status(200).json({ messages, notifications });
  });

  app.patch('/api/inbox/messages/:id/read', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    markMessageRead(req.params.id, user.id);
    res.status(200).json({ status: 'ok' });
  });

  app.patch('/api/inbox/notifications/:id/read', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    markNotificationRead(req.params.id, user.id);
    res.status(200).json({ status: 'ok' });
  });

  app.post('/api/calendar/events', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!user.companyId) {
      res.status(400).json({ error: 'User has no company' });
      return;
    }
    const schema = z.object({
      title: z.string().min(2),
      description: z.string().optional(),
      start_at: z.string().min(10),
      end_at: z.string().min(10),
      participant_user_ids: z.array(z.string()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    const event = createCalendarEvent({
      companyId: user.companyId,
      ownerUserId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      startAt: parsed.data.start_at,
      endAt: parsed.data.end_at,
      participantUserIds: parsed.data.participant_user_ids || [],
    });
    res.status(201).json({ data: event });
  });

  app.get('/api/calendar/my', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!user.companyId) {
      res.status(400).json({ error: 'User has no company' });
      return;
    }
    const events = listCalendarEventsForUser(user.companyId, user.id);
    res.status(200).json({ data: events });
  });

  app.get('/api/calendar/company', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!user.companyId) {
      res.status(400).json({ error: 'User has no company' });
      return;
    }
    const events = listCalendarEventsForCompany(user.companyId);
    res.status(200).json({ data: events });
  });

  registerMetaAdsMcpRoutes(app);
}

