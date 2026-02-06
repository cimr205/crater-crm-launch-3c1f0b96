import express from 'express';
import { initStore } from './db';
import { env } from './config/env';
import { registerRoutes } from './http/routes';
import { ActivityRepositorySqlite } from './repositories/activityRepository';
import { ManagedEmailService } from './services/email/emailService';
import { startCampaignWorker } from './jobs/campaignWorker';
import { startEmailAnalysisWorker } from './jobs/emailAnalysisWorker';
import { startDeadlineWorker } from './jobs/deadlineWorker';
import { startTodoReminderWorker } from './jobs/todoReminderWorker';
import { startMetaAdsAutomation } from './meta-ads-ai';

initStore();

const app = express();
app.use(express.json({ limit: '10mb' }));

const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://www.aiagencydanmark.dk';
const allowedOrigins = new Set(
  [publicBaseUrl, 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'].filter(Boolean)
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
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

app.listen(env.port, () => {
  console.log(`CRM backend running on port ${env.port}`);
});

