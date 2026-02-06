import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import ThemeSelector from '@/components/settings/ThemeSelector';
import LanguageSelector from '@/components/settings/LanguageSelector';
import { useI18n } from '@/lib/i18n';
import { useTenant } from '@/contexts/TenantContext';
import RoleGate from '@/components/RoleGate';
import { api, API_BASE_URL } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

export default function CompanySettingsPage() {
  const { t } = useI18n();
  const { tenant, setTenantTheme, setTenantLanguage } = useTenant();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [integrations, setIntegrations] = useState<null | {
    metaConnected: boolean;
    metaAdAccountId: string | null;
    metaBusinessId: string | null;
    metaTokenExpiresAt: string | null;
    websiteTrackingKey: string;
    websiteDomains: string[];
    metaPixelId: string | null;
    metaCapiTokenSet: boolean;
  }>(null);
  const [domainsInput, setDomainsInput] = useState('');
  const [metaPixelId, setMetaPixelId] = useState('');
  const [metaCapiToken, setMetaCapiToken] = useState('');
  const [savingIntegrations, setSavingIntegrations] = useState(false);
  const [aiActions, setAiActions] = useState<Array<{
    id: string;
    name: string;
    description: string;
    inputs: string[];
    outputs: string[];
    defaultMode: 'draft' | 'auto';
  }>>([]);
  const [aiSettings, setAiSettings] = useState<null | {
    enabledActions: string[];
    toneOfVoice: string;
    autoSendMode: 'draft' | 'auto';
    bookingWindowStart: string;
    bookingWindowEnd: string;
    bookingTimezone: string;
  }>(null);
  const [savingAi, setSavingAi] = useState(false);

  useEffect(() => {
    let active = true;
    api.getTenantIntegrations().then((data) => {
      if (!active) return;
      setIntegrations(data);
      setDomainsInput((data.websiteDomains || []).join(', '));
      setMetaPixelId(data.metaPixelId || '');
      setMetaCapiToken('');
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([api.listAiActions(), api.getAiSettings()]).then(([actionsRes, settingsRes]) => {
      if (!active) return;
      setAiActions(actionsRes.data);
      setAiSettings(settingsRes.data);
    });
    return () => {
      active = false;
    };
  }, []);

  const trackingScript = useMemo(() => {
    if (!integrations?.websiteTrackingKey) return '';
    const endpoint = `${API_BASE_URL}/track`;
    return `<script>
(function(w,d){
  const API="${endpoint}";
  const KEY="${integrations.websiteTrackingKey}";
  function send(event, payload){
    fetch(API,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        key:KEY,
        event:event,
        url:location.href,
        referrer:document.referrer,
        payload:payload||{}
      })
    });
  }
  w.CloudbotTrack=send;
  send("page_view");
})(window,document);
</script>`;
  }, [integrations]);

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      await api.updateCompanySettings({
        language: tenant.defaultLanguage,
        theme: tenant.defaultTheme,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIntegrations = async () => {
    if (!integrations) return;
    setSavingIntegrations(true);
    try {
      const updated = await api.updateTenantIntegrations({
        websiteDomains: domainsInput
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        metaPixelId: metaPixelId || null,
        metaCapiToken: metaCapiToken || null,
      });
      setIntegrations((prev) =>
        prev
          ? {
              ...prev,
              websiteTrackingKey: updated.websiteTrackingKey,
              websiteDomains: updated.websiteDomains,
              metaPixelId: updated.metaPixelId,
              metaCapiTokenSet: updated.metaCapiTokenSet,
            }
          : prev
      );
      setMetaCapiToken('');
    } finally {
      setSavingIntegrations(false);
    }
  };

  const handleUseCurrentDomain = () => {
    const host = window.location.hostname;
    if (!host) return;
    const current = domainsInput
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!current.includes(host)) {
      setDomainsInput([...current, host].join(', '));
    }
  };

  const handleCopyScript = async () => {
    if (!trackingScript) return;
    try {
      await navigator.clipboard.writeText(trackingScript);
      toast({ title: t('settings.scriptCopied') });
    } catch {
      toast({ title: t('settings.scriptCopyFailed') });
    }
  };

  const handleRotateKey = async () => {
    if (!integrations) return;
    setSavingIntegrations(true);
    try {
      const updated = await api.updateTenantIntegrations({ rotateTrackingKey: true });
      setIntegrations((prev) =>
        prev
          ? {
              ...prev,
              websiteTrackingKey: updated.websiteTrackingKey,
              websiteDomains: updated.websiteDomains,
            }
          : prev
      );
    } finally {
      setSavingIntegrations(false);
    }
  };

  const toggleAiAction = (actionId: string) => {
    if (!aiSettings) return;
    const enabled = new Set(aiSettings.enabledActions);
    if (enabled.has(actionId)) {
      enabled.delete(actionId);
    } else {
      enabled.add(actionId);
    }
    setAiSettings({ ...aiSettings, enabledActions: Array.from(enabled) });
  };

  const handleSaveAi = async () => {
    if (!aiSettings) return;
    setSavingAi(true);
    try {
      const updated = await api.updateAiSettings({
        enabledActions: aiSettings.enabledActions,
        toneOfVoice: aiSettings.toneOfVoice,
        autoSendMode: aiSettings.autoSendMode,
        bookingWindowStart: aiSettings.bookingWindowStart,
        bookingWindowEnd: aiSettings.bookingWindowEnd,
        bookingTimezone: aiSettings.bookingTimezone,
      });
      setAiSettings(updated.data);
      toast({ title: t('settings.aiSaved') });
    } finally {
      setSavingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('settings.companyTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.companySubtitle')}</p>
      </div>

      <RoleGate>
        <Card className="p-6 space-y-4 bg-card/70 backdrop-blur border-border">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">{t('settings.tenantId')}</div>
              <div className="text-sm font-medium">{tenant?.tenantId || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t('settings.joinCode')}</div>
              <div className="text-sm font-medium">{tenant?.joinCode || '—'}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground mb-2">{t('settings.defaultLanguage')}</div>
              <LanguageSelector value={tenant?.defaultLanguage || 'en'} onChange={setTenantLanguage} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-2">{t('settings.defaultTheme')}</div>
              <ThemeSelector value={tenant?.defaultTheme || 'light'} onChange={setTenantTheme} />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('common.loading') : t('settings.updateCta')}
          </Button>
        </Card>

        <Card className="p-6 space-y-5 bg-card/70 backdrop-blur border-border">
          <div>
            <h2 className="text-lg font-semibold">{t('settings.integrationsTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('settings.integrationsSubtitle')}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{t('settings.metaStatus')}</div>
              <div className="text-sm font-medium">
                {integrations?.metaConnected ? t('settings.metaConnected') : t('settings.metaNotConnected')}
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  const response = await api.startMetaConnect();
                  if (response.auth_url) {
                    window.location.href = response.auth_url;
                  }
                }}
              >
                {integrations?.metaConnected ? t('settings.metaReconnect') : t('settings.metaConnect')}
              </Button>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{t('settings.metaPixelId')}</div>
              <Input
                value={metaPixelId}
                onChange={(event) => setMetaPixelId(event.target.value)}
                placeholder="1234567890"
              />
              <div className="text-xs text-muted-foreground">{t('settings.metaCapiToken')}</div>
              <Input
                value={metaCapiToken}
                onChange={(event) => setMetaCapiToken(event.target.value)}
                placeholder={integrations?.metaCapiTokenSet ? t('settings.metaCapiTokenSet') : ''}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{t('settings.allowedDomains')}</div>
              <Input
                value={domainsInput}
                onChange={(event) => setDomainsInput(event.target.value)}
                placeholder="example.com, app.example.com"
              />
              <Button variant="ghost" onClick={handleUseCurrentDomain}>
                {t('settings.useCurrentDomain')}
              </Button>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{t('settings.trackingKey')}</div>
              <div className="rounded-md border border-border px-3 py-2 text-xs font-mono bg-muted/40">
                {integrations?.websiteTrackingKey || '—'}
              </div>
              <Button variant="ghost" onClick={handleRotateKey} disabled={savingIntegrations}>
                {t('settings.rotateTrackingKey')}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{t('settings.trackingScript')}</div>
            <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs">
              {trackingScript || '—'}
            </pre>
            <Button variant="outline" onClick={handleCopyScript}>
              {t('settings.copyScript')}
            </Button>
          </div>

          <Button onClick={handleSaveIntegrations} disabled={savingIntegrations}>
            {savingIntegrations ? t('common.loading') : t('settings.saveIntegrations')}
          </Button>
        </Card>

        <Card className="p-6 space-y-5 bg-card/70 backdrop-blur border-border">
          <div>
            <h2 className="text-lg font-semibold">{t('settings.aiActionsTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('settings.aiActionsSubtitle')}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{t('settings.aiTone')}</div>
              <Input
                value={aiSettings?.toneOfVoice || ''}
                onChange={(event) =>
                  aiSettings && setAiSettings({ ...aiSettings, toneOfVoice: event.target.value })
                }
                placeholder={t('settings.aiTonePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{t('settings.aiAutoSend')}</div>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={aiSettings?.autoSendMode || 'draft'}
                onChange={(event) =>
                  aiSettings && setAiSettings({ ...aiSettings, autoSendMode: event.target.value as 'draft' | 'auto' })
                }
              >
                <option value="draft">{t('settings.aiAutoSendDraft')}</option>
                <option value="auto">{t('settings.aiAutoSendAuto')}</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{t('settings.aiBookingStart')}</div>
              <Input
                value={aiSettings?.bookingWindowStart || ''}
                onChange={(event) =>
                  aiSettings && setAiSettings({ ...aiSettings, bookingWindowStart: event.target.value })
                }
                placeholder="09:00"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{t('settings.aiBookingEnd')}</div>
              <Input
                value={aiSettings?.bookingWindowEnd || ''}
                onChange={(event) =>
                  aiSettings && setAiSettings({ ...aiSettings, bookingWindowEnd: event.target.value })
                }
                placeholder="16:00"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{t('settings.aiTimezone')}</div>
              <Input
                value={aiSettings?.bookingTimezone || ''}
                onChange={(event) =>
                  aiSettings && setAiSettings({ ...aiSettings, bookingTimezone: event.target.value })
                }
                placeholder="Europe/Copenhagen"
              />
            </div>
          </div>

          <div className="grid gap-3">
            {aiActions.map((action) => {
              const enabled = aiSettings?.enabledActions?.includes(action.id);
              return (
                <div
                  key={action.id}
                  className="flex flex-col gap-2 rounded-md border border-border p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{action.name}</div>
                      <div className="text-xs text-muted-foreground">{action.description}</div>
                    </div>
                    <Button variant={enabled ? 'default' : 'outline'} onClick={() => toggleAiAction(action.id)}>
                      {enabled ? t('settings.aiEnabled') : t('settings.aiEnable')}
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('settings.aiInputs')}: {action.inputs.join(', ')} · {t('settings.aiOutputs')}: {action.outputs.join(', ')}
                  </div>
                </div>
              );
            })}
          </div>

          <Button onClick={handleSaveAi} disabled={savingAi}>
            {savingAi ? t('common.loading') : t('settings.aiSave')}
          </Button>
        </Card>
      </RoleGate>
    </div>
  );
}

