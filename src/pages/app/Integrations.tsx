import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import {
  getServiceConfig,
  setServiceConfig,
  clearServiceConfig,
  isConfigured,
  type ServiceConfig,
} from '@/lib/serviceConfig';
import * as ee from '@/lib/emailengine';
import * as lm from '@/lib/listmonk';
import * as vk from '@/lib/vikunja';
import * as dt from '@/lib/donetick';
import * as ac from '@/lib/emailclassify';
import {
  CheckCircle, XCircle, Loader2, ExternalLink, Trash2, Save,
  ChevronDown, ChevronUp, Bot, Mail, CreditCard, CalendarDays,
  BarChart2, Plug, Zap, RefreshCw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = { id: string; label: string; supportsOAuth: boolean };
type Connection = { provider: string; connectedAt: string; updatedAt: string };

type IntegrationStatus = 'connected' | 'available' | 'coming_soon';

type IntegrationCard = {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  status: IntegrationStatus;
  isActive?: boolean;
  providerId?: string;   // for OAuth
  href?: string;         // for in-app navigation
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function openCenteredPopup(url: string, title: string) {
  const width = 520, height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  return window.open(url, title, `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
}

function statusBadge(status: IntegrationStatus, isActive?: boolean) {
  if (status === 'connected') {
    return (
      <Badge className="text-xs bg-green-500/15 text-green-600 border-green-500/20 hover:bg-green-500/15">
        Forbundet
      </Badge>
    );
  }
  if (status === 'coming_soon') {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
        Kommer snart
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs text-blue-600 border-blue-500/30 bg-blue-500/8">
      Tilgængelig
    </Badge>
  );
}

// ─── Integration card component ───────────────────────────────────────────────

function IntCard({
  card,
  onConnect,
  onDisconnect,
}: {
  card: IntegrationCard;
  onConnect?: (card: IntegrationCard) => void;
  onDisconnect?: (card: IntegrationCard) => void;
}) {
  const Icon = card.icon;
  return (
    <Card className="p-5 bg-card/80 border-border flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
        {statusBadge(card.status, card.isActive)}
      </div>

      <div className="space-y-1 flex-1">
        <div className="text-sm font-semibold">{card.label}</div>
        <p className="text-xs text-muted-foreground leading-relaxed">{card.description}</p>
      </div>

      {card.status === 'connected' && card.isActive && (
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle className="h-3.5 w-3.5" />
          Aktiv
        </div>
      )}

      {card.status === 'available' && onConnect && (
        <Button size="sm" variant="outline" onClick={() => onConnect(card)} className="w-fit">
          Forbind
        </Button>
      )}

      {card.status === 'connected' && onDisconnect && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDisconnect(card)}
          className="w-fit text-muted-foreground hover:text-destructive"
        >
          Afbryd
        </Button>
      )}

      {card.status === 'coming_soon' && (
        <p className="text-xs text-muted-foreground italic">Denne integration er under udvikling</p>
      )}
    </Card>
  );
}

// ─── Self-hosted service definitions ──────────────────────────────────────────

type ServiceDef = {
  key: string;
  label: string;
  description: string;
  docsUrl: string;
  ghUrl: string;
  authType: 'bearer' | 'basic' | 'apikey';
  hasAccountId?: boolean;
  hasProjectId?: boolean;
  testFn: () => Promise<{ ok: boolean; error?: string }>;
};

const SELF_HOSTED_SERVICES: ServiceDef[] = [
  {
    key: 'emailengine',
    label: 'EmailEngine',
    description: 'Email-synkronisering via IMAP/SMTP REST API.',
    docsUrl: 'https://emailengine.app/api',
    ghUrl: 'https://github.com/postalsys/emailengine',
    authType: 'bearer',
    hasAccountId: true,
    testFn: ee.testConnection,
  },
  {
    key: 'listmonk',
    label: 'Listmonk',
    description: 'Self-hosted mailing-list platform til bulk-udsendelse.',
    docsUrl: 'https://listmonk.app/docs/apis/apis/',
    ghUrl: 'https://github.com/knadh/listmonk',
    authType: 'basic',
    testFn: lm.testConnection,
  },
  {
    key: 'vikunja',
    label: 'Vikunja',
    description: 'Synkroniserer godkendte CRM-opgaver til Vikunja task manager.',
    docsUrl: 'https://vikunja.io/docs/api',
    ghUrl: 'https://github.com/go-vikunja/vikunja',
    authType: 'bearer',
    hasProjectId: true,
    testFn: vk.testConnection,
  },
  {
    key: 'donetick',
    label: 'Donetick',
    description: 'Personlige to-dos via Donetick task-tracker.',
    docsUrl: 'https://donetick.com',
    ghUrl: 'https://github.com/donetick/donetick',
    authType: 'bearer',
    testFn: dt.testConnection,
  },
  {
    key: 'aiclassify',
    label: 'AI Email Classification',
    description: 'Klassificerer indkommende mails med ML.',
    docsUrl: 'https://github.com/waleedmagdy/AI-Email-Classification-Automation-System',
    ghUrl: 'https://github.com/waleedmagdy/AI-Email-Classification-Automation-System',
    authType: 'apikey',
    testFn: ac.testConnection,
  },
];

function ServiceCard({ svc }: { svc: ServiceDef }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<ServiceConfig>(() => getServiceConfig(svc.key) ?? { url: '' });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const configured = isConfigured(svc.key);

  const handleSave = () => {
    if (!cfg.url.trim()) { toast({ title: 'URL er påkrævet', variant: 'destructive' }); return; }
    setServiceConfig(svc.key, cfg);
    toast({ title: `${svc.label} gemt` });
    setTestResult(null);
  };

  const handleClear = () => {
    clearServiceConfig(svc.key);
    setCfg({ url: '' });
    setTestResult(null);
    toast({ title: `${svc.label} konfiguration slettet` });
  };

  const handleTest = async () => {
    if (!cfg.url.trim()) { toast({ title: 'Gem konfigurationen først', variant: 'destructive' }); return; }
    setServiceConfig(svc.key, cfg);
    setTesting(true);
    setTestResult(null);
    try {
      const result = await svc.testFn();
      setTestResult(result.ok ? 'ok' : 'fail');
      if (!result.ok) toast({ title: `Forbindelsesfejl: ${result.error ?? 'ukendt fejl'}`, variant: 'destructive' });
      else toast({ title: `${svc.label} forbundet ✓` });
    } catch (e) {
      setTestResult('fail');
      toast({ title: (e as Error).message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="bg-card/70 border-border overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{svc.label}</span>
              {configured ? (
                testResult === 'ok' ? (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">Forbundet ✓</Badge>
                ) : testResult === 'fail' ? (
                  <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">Fejl</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">Konfigureret</Badge>
                )
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">Ikke konfigureret</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">{svc.description}</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          <div className="flex gap-4 text-xs text-muted-foreground">
            <a href={svc.ghUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground">
              <ExternalLink className="h-3 w-3" />GitHub
            </a>
            <a href={svc.docsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground">
              <ExternalLink className="h-3 w-3" />Dokumentation
            </a>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Service URL *</label>
            <Input placeholder="https://service.example.com" value={cfg.url} onChange={(e) => setCfg((c) => ({ ...c, url: e.target.value }))} />
          </div>
          {svc.authType === 'basic' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Brugernavn</label>
                <Input placeholder="admin" value={cfg.username ?? ''} onChange={(e) => setCfg((c) => ({ ...c, username: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Adgangskode</label>
                <Input type="password" placeholder="••••••••" value={cfg.password ?? ''} onChange={(e) => setCfg((c) => ({ ...c, password: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">
                {svc.authType === 'apikey' ? 'API-nøgle' : 'Access Token'}
              </label>
              <Input type="password" placeholder="••••••••" value={cfg.token ?? ''} onChange={(e) => setCfg((c) => ({ ...c, token: e.target.value }))} />
            </div>
          )}
          {svc.hasAccountId && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Standard e-mail konto (account ID)</label>
              <Input placeholder="din@email.com" value={cfg.accountId ?? ''} onChange={(e) => setCfg((c) => ({ ...c, accountId: e.target.value }))} />
            </div>
          )}
          {svc.hasProjectId && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Standard projekt ID (valgfrit)</label>
              <Input placeholder="1" value={cfg.defaultProjectId ?? ''} onChange={(e) => setCfg((c) => ({ ...c, defaultProjectId: e.target.value }))} />
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={handleSave}><Save className="h-3.5 w-3.5 mr-1" />Gem</Button>
            <Button size="sm" variant="outline" onClick={() => void handleTest()} disabled={testing}>
              {testing ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Tester...</>
                : testResult === 'ok' ? <><CheckCircle className="h-3.5 w-3.5 mr-1 text-green-500" />Forbundet</>
                : testResult === 'fail' ? <><XCircle className="h-3.5 w-3.5 mr-1 text-red-500" />Fejlede</>
                : 'Test forbindelse'}
            </Button>
            {configured && (
              <Button size="sm" variant="ghost" onClick={handleClear} className="text-destructive hover:text-destructive ml-auto">
                <Trash2 className="h-3.5 w-3.5 mr-1" />Slet
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [metaConnected, setMetaConnected] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadOAuth = useCallback(async () => {
    try {
      const result = await api.listIntegrationProviders();
      setProviders(result.providers);
      setConnections(result.connections);
    } catch { /* optional */ }
    try {
      const metaRes = await api.getMetaStatus();
      setMetaConnected(metaRes.connected);
    } catch { /* optional */ }
  }, []);

  useEffect(() => {
    void loadOAuth();
    const handler = (event: MessageEvent) => {
      if ((event.data as { type?: string })?.type === 'integration:connected') {
        void loadOAuth();
        toast({ title: 'Integration tilsluttet' });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadOAuth, toast]);

  const connectedMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    connections.forEach((c) => { map[c.provider] = true; });
    return map;
  }, [connections]);

  const gmailConnected = connectedMap['gmail'] ?? false;
  const googleCalendarConnected = connectedMap['google_calendar'] ?? false;

  // ── Integration card definitions ──────────────────────────────────────────

  const aiCards: IntegrationCard[] = [
    {
      id: 'clowdbot',
      label: 'ClowdBot AI',
      description: 'AI-drevet analyse og anbefalinger via Lovable AI',
      icon: Bot,
      iconBg: 'bg-blue-500/15 text-blue-600',
      status: 'connected',
      isActive: true,
    },
  ];

  const emailCards: IntegrationCard[] = [
    {
      id: 'gmail',
      label: 'Gmail',
      description: 'Synkroniser emails og opret automatiske to-dos',
      icon: Mail,
      iconBg: 'bg-red-500/10 text-red-600',
      status: gmailConnected ? 'connected' : 'available',
      providerId: 'gmail',
      isActive: gmailConnected,
    },
    {
      id: 'outlook',
      label: 'Outlook',
      description: 'Microsoft email integration',
      icon: Mail,
      iconBg: 'bg-blue-500/10 text-blue-600',
      status: 'coming_soon',
    },
  ];

  const paymentCards: IntegrationCard[] = [
    {
      id: 'stripe',
      label: 'Stripe',
      description: 'Online betalinger og abonnementer',
      icon: CreditCard,
      iconBg: 'bg-purple-500/10 text-purple-600',
      status: connectedMap['stripe'] ? 'connected' : 'available',
      providerId: 'stripe',
    },
    {
      id: 'quickpay',
      label: 'QuickPay',
      description: 'Dansk betalingsgateway',
      icon: CreditCard,
      iconBg: 'bg-blue-500/10 text-blue-600',
      status: connectedMap['quickpay'] ? 'connected' : 'available',
      providerId: 'quickpay',
    },
  ];

  const calendarCards: IntegrationCard[] = [
    {
      id: 'google_calendar',
      label: 'Google Kalender',
      description: 'Synkroniser opgaver og møder med Google Calendar',
      icon: CalendarDays,
      iconBg: 'bg-green-500/10 text-green-600',
      status: googleCalendarConnected ? 'connected' : 'available',
      providerId: 'google_calendar',
      isActive: googleCalendarConnected,
    },
    {
      id: 'outlook_calendar',
      label: 'Outlook Kalender',
      description: 'Microsoft 365 kalenderintegration',
      icon: CalendarDays,
      iconBg: 'bg-blue-500/10 text-blue-600',
      status: 'coming_soon',
    },
  ];

  const adsCards: IntegrationCard[] = [
    {
      id: 'meta_ads',
      label: 'Meta Ads',
      description: 'Facebook & Instagram kampagner, spend, CTR, ROAS og AI-analyse',
      icon: BarChart2,
      iconBg: 'bg-blue-500/10 text-blue-600',
      status: metaConnected ? 'connected' : 'available',
      href: 'meta/ads',
      isActive: metaConnected,
    },
    {
      id: 'google_ads',
      label: 'Google Ads',
      description: 'Google Ads kampagner og performance data',
      icon: BarChart2,
      iconBg: 'bg-yellow-500/10 text-yellow-600',
      status: 'coming_soon',
    },
    {
      id: 'tiktok_ads',
      label: 'TikTok Ads',
      description: 'TikTok annoncering og video ad performance',
      icon: BarChart2,
      iconBg: 'bg-pink-500/10 text-pink-600',
      status: 'coming_soon',
    },
  ];

  const allCards = [...aiCards, ...emailCards, ...paymentCards, ...calendarCards, ...adsCards];
  const connectedCount = allCards.filter((c) => c.status === 'connected').length;
  const availableCount = allCards.filter((c) => c.status === 'available').length;
  const comingSoonCount = allCards.filter((c) => c.status === 'coming_soon').length;

  const handleConnect = async (card: IntegrationCard) => {
    if (!card.providerId) return;
    setOauthLoading(true);
    try {
      if (card.id === 'meta_ads') {
        const res = await api.startMetaConnect();
        openCenteredPopup(res.auth_url, 'Connect Meta');
      } else {
        const authUrl = api.getIntegrationAuthUrl(card.providerId);
        if (authUrl) openCenteredPopup(authUrl, `Connect ${card.label}`);
        else toast({ title: 'Ikke autentificeret' });
      }
    } catch (e) {
      toast({ title: (e as Error).message || 'Tilslutning fejlede', variant: 'destructive' });
    } finally {
      setOauthLoading(false);
    }
  };

  const handleDisconnect = async (card: IntegrationCard) => {
    if (!card.providerId) return;
    setOauthLoading(true);
    try {
      await api.disconnectIntegration(card.providerId);
      await loadOAuth();
      toast({ title: `${card.label} afbrudt` });
    } catch (e) {
      toast({ title: (e as Error).message || 'Afbrydelse fejlede', variant: 'destructive' });
    } finally {
      setOauthLoading(false);
    }
  };

  function renderSection(title: string, icon: React.ElementType, cards: IntegrationCard[]) {
    const Icon = icon;
    return (
      <section key={title} className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <IntCard
              key={card.id}
              card={card}
              onConnect={card.providerId || card.id === 'meta_ads' ? () => void handleConnect(card) : undefined}
              onDisconnect={card.providerId ? () => void handleDisconnect(card) : undefined}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Plug className="h-6 w-6" />
            Integrationer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Forbind eksterne tjenester til dit system
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadOAuth()} disabled={oauthLoading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${oauthLoading ? 'animate-spin' : ''}`} />
          Opdater
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5 bg-card/80 border-border">
          <div className="text-xs text-muted-foreground mb-1">Forbundne</div>
          <div className="text-2xl font-bold text-green-600">{connectedCount}</div>
        </Card>
        <Card className="p-5 bg-card/80 border-border">
          <div className="text-xs text-muted-foreground mb-1">Tilgængelige</div>
          <div className="text-2xl font-bold text-blue-600">{availableCount}</div>
        </Card>
        <Card className="p-5 bg-card/80 border-border">
          <div className="text-xs text-muted-foreground mb-1">Kommer snart</div>
          <div className="text-2xl font-bold text-muted-foreground">{comingSoonCount}</div>
        </Card>
      </div>

      {/* Category sections */}
      {renderSection('AI', Bot, aiCards)}
      {renderSection('Email', Mail, emailCards)}
      {renderSection('Betaling', CreditCard, paymentCards)}
      {renderSection('Kalender', CalendarDays, calendarCards)}
      {renderSection('Annoncering', BarChart2, adsCards)}

      {/* Advanced / self-hosted */}
      <section className="space-y-3">
        <button
          className="flex items-center gap-2 text-sm font-semibold hover:text-foreground text-muted-foreground transition-colors"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <Zap className="h-4 w-4" />
          Self-hosted tjenester (avanceret)
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showAdvanced && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Konfigurer dine egne instanser. Credentials gemmes lokalt i browseren.
            </p>
            {SELF_HOSTED_SERVICES.map((svc) => (
              <ServiceCard key={svc.key} svc={svc} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
