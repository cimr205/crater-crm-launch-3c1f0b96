import express from 'express';
import { initStore, readStore } from './db';
import { env } from './config/env';
import { registerRoutes } from './http/routes';
import { ActivityRepositorySqlite } from './repositories/activityRepository';
import { ManagedEmailService } from './services/email/emailService';
import { syncUsers } from './services/postgresUsers';
import { syncCompanies } from './services/postgresCompanies';
import { startCampaignWorker } from './jobs/campaignWorker';
import { startEmailAnalysisWorker } from './jobs/emailAnalysisWorker';
import { startDeadlineWorker } from './jobs/deadlineWorker';
import { startTodoReminderWorker } from './jobs/todoReminderWorker';
import { startMetaAdsAutomation } from './meta-ads-ai';
import { startClowdBotWorker } from './jobs/clowdBotWorker';
import { startMetaLeadWorker } from './jobs/metaLeadWorker';
import { startLeadWorker } from './workers/leadWorker';
import { startWorkflowWorker } from './workers/workflowWorker';
import { startAiAnalysisCron } from './services/ai/aiAnalysis';
import { startAiDailyFocusCron } from './services/ai/aiDailyFocus';

initStore();
void (async () => {
  try {
    const store = readStore();
    await syncUsers(store.users);
    await syncCompanies(store.companies);
  } catch (error) {
    console.error('Postgres user sync failed:', error);
  }
})();

const app = express();
app.use(express.json({ limit: '10mb' }));

const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://aiagencydanmark.dk';
const allowedOrigins = new Set(
  [
    publicBaseUrl,
    publicBaseUrl.replace('https://', 'https://www.'),
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080',
  ].filter(Boolean)
);
const originPatterns = [
  /^https?:\/\/.*\.lovable\.app$/i,
  /^https?:\/\/.*\.lovableproject\.com$/i,
];

app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  if (origin) {
    const isAllowed = allowedOrigins.has(origin) || originPatterns.some((pattern) => pattern.test(origin));
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      const requestedHeaders = req.headers['access-control-request-headers'];
      res.setHeader(
        'Access-Control-Allow-Headers',
        requestedHeaders ? String(requestedHeaders) : 'Content-Type, Authorization, X-Tenant-Id'
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    }
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

const activities = new ActivityRepositorySqlite();
const email = new ManagedEmailService(activities);

registerRoutes(app, { email });

startCampaignWorker(email);
startEmailAnalysisWorker();
startDeadlineWorker();
startTodoReminderWorker();
startMetaAdsAutomation();
startClowdBotWorker();
startMetaLeadWorker();
startLeadWorker();
startWorkflowWorker();
startAiAnalysisCron();
startAiDailyFocusCron();

app.listen(env.port, () => {
  console.log(`CRM backend running on port ${env.port}`);
});

