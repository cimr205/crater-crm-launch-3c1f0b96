const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://aiagencydanmark.dk';
const backendBaseUrl =
  process.env.BACKEND_BASE_URL || process.env.PUBLIC_BASE_URL || 'https://api.aiagencydanmark.dk';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || `${backendBaseUrl}/api/auth/google/callback`,
  gmailClientId: process.env.GMAIL_CLIENT_ID || '',
  gmailClientSecret: process.env.GMAIL_CLIENT_SECRET || '',
  gmailRedirectUri: process.env.GMAIL_REDIRECT_URI || `${backendBaseUrl}/api/gmail/callback`,
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  openAiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  campaignRateLimitPerMinute: Number(process.env.CAMPAIGN_RATE_LIMIT_PER_MINUTE || 60),
  metaAppId: process.env.META_APP_ID || '',
  metaAppSecret: process.env.META_APP_SECRET || '',
  metaRedirectUri: process.env.META_REDIRECT_URI || `${backendBaseUrl}/api/meta/callback`,
  metaApiVersion: process.env.META_API_VERSION || 'v18.0',
  metaTokenEncryptionKey: process.env.META_TOKEN_ENCRYPTION_KEY || '',
  metaAutomationEnabled: process.env.META_AUTOMATION_ENABLED === 'true',
};

