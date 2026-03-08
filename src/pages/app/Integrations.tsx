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
import { CheckCircle, XCircle, Loader2, ExternalLink, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';

// ─── OAuth providers (existing) ───────────────────────────────────────────────

type Provider = { id: string; label: string; supportsOAuth: boolean };
type Connection = { provider: string; connectedAt: string; updatedAt: string };

function openCenteredPopup(url: string, title: string) {
  const width = 520, height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  return window.open(url, title, `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
}

// ─── Self-hosted service definitions ─────────────────────────────────────────

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
    description: 'Email-synkronisering — henter og sender mails fra Indbakke og Emails via IMAP/SMTP REST API.',
    docsUrl: 'https://emailengine.app/api',
    ghUrl: 'https://github.com/postalsys/emailengine',
    authType: 'bearer',
    hasAccountId: true,
    testFn: ee.testConnection,
  },
  {
    key: 'listmonk',
    label: 'Listmonk',
    description: 'Email-kampagner — self-hosted mailing-list platform til bulk-udsendelse med tracking.',
    docsUrl: 'https://listmonk.app/docs/apis/apis/',
    ghUrl: 'https://github.com/knadh/listmonk',
    authType: 'basic',
    testFn: lm.testConnection,
  },
  {
    key: 'vikunja',
    label: 'Vikunja',
    description: 'Opgave-synkronisering — synkroniserer godkendte CRM-opgaver til Vikunja task manager.',
    docsUrl: 'https://vikunja.io/docs/api',
    ghUrl: 'https://github.com/go-vikunja/vikunja',
    authType: 'bearer',
    hasProjectId: true,
    testFn: vk.testConnection,
  },
  {
    key: 'donetick',
    label: 'Donetick',
    description: 'To-do backend — viser og styrer personlige to-dos via Donetick task-tracker.',
    docsUrl: 'https://donetick.com',
    ghUrl: 'https://github.com/donetick/donetick',
    authType: 'bearer',
    testFn: dt.testConnection,
  },
  {
    key: 'aiclassify',
    label: 'AI Email Classification',
    description: 'Intelligent email-prioritering — klassificerer indkommende mails med ML og markerer vigtige.',
    docsUrl: 'https://github.com/waleedmagdy/AI-Email-Classification-Automation-System',
    ghUrl: 'https://github.com/waleedmagdy/AI-Email-Classification-Automation-System',
    authType: 'apikey',
    testFn: ac.testConnection,
  },
];

// ─── Individual service card ──────────────────────────────────────────────────

function ServiceCard({ svc }: { svc: ServiceDef }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<ServiceConfig>(() => getServiceConfig(svc.key) ?? { url: '' });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const configured = isConfigured(svc.key);

  const handleSave = () => {
    if (!cfg.url.trim()) {
      toast({ title: 'URL er påkrævet', variant: 'destructive' });
      return;
    }
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
    if (!cfg.url.trim()) {
      toast({ title: 'Gem konfigurationen først', variant: 'destructive' });
      return;
    }
    setServiceConfig(svc.key, cfg);
    setTesting(true);
    setTestResult(null);
    try {
      const result = await svc.testFn();
      setTestResult(result.ok ? 'ok' : 'fail');
      if (!result.ok) {
        toast({ title: `Forbindelsesfejl: ${result.error ?? 'ukendt fejl'}`, variant: 'destructive' });
      } else {
        toast({ title: `${svc.label} forbundet ✓` });
      }
    } catch (e) {
      setTestResult('fail');
      toast({ title: (e as Error).message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="bg-card/70 backdrop-blur border-border overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/20 transition-colors"
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
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
          {/* Description + links */}
          <p className="text-xs text-muted-foreground">{svc.description}</p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <a href={svc.ghUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground">
              <ExternalLink className="h-3 w-3" />GitHub
            </a>
            <a href={svc.docsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground">
              <ExternalLink className="h-3 w-3" />Dokumentation
            </a>
          </div>

          {/* URL */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Service URL *</label>
            <Input
              placeholder="https://service.example.com"
              value={cfg.url}
              onChange={(e) => setCfg((c) => ({ ...c, url: e.target.value }))}
            />
          </div>

          {/* Auth fields */}
          {svc.authType === 'basic' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Brugernavn</label>
                <Input
                  placeholder="listmonk"
                  value={cfg.username ?? ''}
                  onChange={(e) => setCfg((c) => ({ ...c, username: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Adgangskode / API-nøgle</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={cfg.password ?? ''}
                  onChange={(e) => setCfg((c) => ({ ...c, password: e.target.value }))}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">
                {svc.authType === 'apikey' ? 'API-nøgle' : 'Access Token / API Token'}
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={cfg.token ?? ''}
                onChange={(e) => setCfg((c) => ({ ...c, token: e.target.value }))}
              />
            </div>
          )}

          {/* EmailEngine: account ID */}
          {svc.hasAccountId && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Standard e-mail konto (account ID)</label>
              <Input
                placeholder="din@email.com"
                value={cfg.accountId ?? ''}
                onChange={(e) => setCfg((c) => ({ ...c, accountId: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">E-mail-adressen på den konto der er registreret i EmailEngine.</p>
            </div>
          )}

          {/* Vikunja: default project */}
          {svc.hasProjectId && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Standard projekt ID (valgfrit)</label>
              <Input
                placeholder="1"
                value={cfg.defaultProjectId ?? ''}
                onChange={(e) => setCfg((c) => ({ ...c, defaultProjectId: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">ID på det Vikunja-projekt nye opgaver oprettes i (ses i URL'en).</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={handleSave}>
              <Save className="h-3.5 w-3.5 mr-1" />Gem
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handleTest()} disabled={testing}>
              {testing ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Tester...</>
              ) : testResult === 'ok' ? (
                <><CheckCircle className="h-3.5 w-3.5 mr-1 text-green-500" />Forbundet</>
              ) : testResult === 'fail' ? (
                <><XCircle className="h-3.5 w-3.5 mr-1 text-red-500" />Fejlede</>
              ) : (
                'Test forbindelse'
              )}
            </Button>
            {configured && (
              <Button size="sm" variant="ghost" onClick={handleClear} className="text-destructive hover:text-destructive ml-auto">
                <Trash2 className="h-3.5 w-3.5 mr-1" />Slet konfiguration
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
  const [oauthLoading, setOauthLoading] = useState(false);

  const loadOAuth = useCallback(async () => {
    try {
      const result = await api.listIntegrationProviders();
      setProviders(result.providers);
      setConnections(result.connections);
    } catch {
      // OAuth providers optional — don't block the page
    }
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

  const handleOAuthConnect = async (providerId: string) => {
    setOauthLoading(true);
    try {
      const authUrl = api.getIntegrationAuthUrl(providerId);
      if (authUrl) openCenteredPopup(authUrl, `Connect ${providerId}`);
      else toast({ title: 'Ikke autentificeret' });
    } catch (e) {
      toast({ title: (e as Error).message || 'Tilslutning fejlede' });
    } finally {
      setOauthLoading(false);
    }
  };

  const handleOAuthDisconnect = async (providerId: string) => {
    setOauthLoading(true);
    try {
      await api.disconnectIntegration(providerId);
      await loadOAuth();
      toast({ title: 'Integration afbrudt' });
    } catch (e) {
      toast({ title: (e as Error).message || 'Afbrydelse fejlede', variant: 'destructive' });
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Integrationer</h1>
        <p className="text-sm text-muted-foreground">
          Tilslut self-hosted services og OAuth-udbydere. Credentials gemmes lokalt i din browser.
        </p>
      </div>

      {/* ── Self-hosted services ── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Self-hosted tjenester</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Konfigurer dine egne instanser af EmailEngine, Listmonk, Vikunja og Donetick nedenfor.
          </p>
        </div>
        <div className="space-y-3">
          {SELF_HOSTED_SERVICES.map((svc) => (
            <ServiceCard key={svc.key} svc={svc} />
          ))}
        </div>
      </section>

      {/* ── OAuth providers ── */}
      {providers.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">OAuth-udbydere</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tilslut via OAuth-popup. Sessionen håndteres af backend-serveren.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => {
              const connected = Boolean(connectedMap[provider.id]);
              return (
                <Card key={provider.id} className="p-5 space-y-3 bg-card/70 backdrop-blur border-border">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{provider.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {connected ? 'Forbundet' : provider.supportsOAuth ? 'Ikke forbundet' : 'Kommer snart'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void handleOAuthConnect(provider.id)} disabled={!provider.supportsOAuth || oauthLoading || connected}>
                      Forbind
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void handleOAuthDisconnect(provider.id)} disabled={!connected || oauthLoading}>
                      Afbryd
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Setup guide ── */}
      <Card className="p-5 bg-card/70 border-border">
        <div className="text-sm font-semibold mb-3">Hurtig opsætningsvejledning</div>
        <div className="space-y-3 text-xs text-muted-foreground">
          <div>
            <strong className="text-foreground">EmailEngine</strong>
            <p>Installer via Docker: <code className="bg-muted px-1 rounded">docker run -p 3000:3000 postalsys/emailengine</code>. Tilslut din mailboks via EmailEngine-UI og hent access token under Settings → API Access.</p>
          </div>
          <div>
            <strong className="text-foreground">Listmonk</strong>
            <p>Installer via Docker Compose (se dokumentation). Log ind med admin og opret mindst én mailing-liste. Brug admin-brugernavn + adgangskode som credentials.</p>
          </div>
          <div>
            <strong className="text-foreground">Vikunja</strong>
            <p>Installer via Docker, log ind og opret API-token under Profil → API-tokens. Opret et projekt og notér ID'et (vises i URL: <code className="bg-muted px-1 rounded">/projects/ID/</code>).</p>
          </div>
          <div>
            <strong className="text-foreground">Donetick</strong>
            <p>Installer via Docker. Log ind og generer API-token under Profil-indstillinger. Brug dette token som access token.</p>
          </div>
          <div>
            <strong className="text-foreground">AI Email Classification</strong>
            <p>Deploy <code className="bg-muted px-1 rounded">waleedmagdy/AI-Email-Classification-Automation-System</code> og angiv den URL + API-nøgle systemet eksponerer på <code className="bg-muted px-1 rounded">POST /classify</code>.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
