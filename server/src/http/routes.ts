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
import { createCompany, listCompaniesWithCounts } from '../repositories/companyRepository';
import { readStore } from '../db';
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
      const company = createCompany({ name: parsed.data.company_name, ownerUserId: userId });
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
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
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
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
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
}

