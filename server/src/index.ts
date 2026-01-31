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

