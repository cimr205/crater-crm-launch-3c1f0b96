import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n, isLocale } from '@/lib/i18n';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import ThemeSelector from '@/components/settings/ThemeSelector';
import LanguageSelector from '@/components/settings/LanguageSelector';
import { api, API_BASE_URL } from '@/lib/api';
import { markOnboardingComplete } from '@/lib/onboarding';
import { useToast } from '@/components/ui/use-toast';

type StepKey = 'basics' | 'team' | 'integrations' | 'finish';

export default function OnboardingPage() {
  const { t } = useI18n();
  const { tenant, setTenantLanguage, setTenantTheme } = useTenant();
  const { user } = useAuth();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<StepKey>('basics');
  const [savingBasics, setSavingBasics] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'user'>('user');
  const [invites, setInvites] = useState<Array<{ email: string; role: string }>>([]);
  const [savingInvite, setSavingInvite] = useState(false);
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

  useEffect(() => {
    if (step !== 'integrations') return;
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
  }, [step]);

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

  const handleSaveBasics = async () => {
    if (!tenant) return;
    setSavingBasics(true);
    try {
      await api.updateCompanySettings({
        language: tenant.defaultLanguage,
        theme: tenant.defaultTheme,
      });
      setStep('team');
    } finally {
      setSavingBasics(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSavingInvite(true);
    try {
      await api.createInvitation(inviteEmail.trim(), inviteRole);
      setInvites((prev) => [...prev, { email: inviteEmail.trim(), role: inviteRole }]);
      setInviteEmail('');
    } finally {
      setSavingInvite(false);
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
      setStep('finish');
    } finally {
      setSavingIntegrations(false);
    }
  };

  const handleFinish = () => {
    markOnboardingComplete();
    navigate(`/${locale}/app/dashboard`);
  };

  if (!user || (user.role !== 'owner' && !user.is_global_admin)) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="p-6 bg-card/70 backdrop-blur border-border">
          <h1 className="text-xl font-semibold">{t('onboarding.adminOnlyTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('onboarding.adminOnlySubtitle')}</p>
          <Button className="mt-4" onClick={() => navigate(`/${locale}/app/dashboard`)}>
            {t('onboarding.backToDashboard')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('onboarding.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('onboarding.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className={step === 'basics' ? 'text-primary' : ''}>{t('onboarding.steps.basics.label')}</span>
        <span>•</span>
        <span className={step === 'team' ? 'text-primary' : ''}>{t('onboarding.steps.team.label')}</span>
        <span>•</span>
        <span className={step === 'integrations' ? 'text-primary' : ''}>{t('onboarding.steps.integrations.label')}</span>
        <span>•</span>
        <span className={step === 'finish' ? 'text-primary' : ''}>{t('onboarding.steps.finish.label')}</span>
      </div>

      {step === 'basics' && (
        <Card className="p-6 space-y-5 bg-card/70 backdrop-blur border-border">
          <div>
            <h2 className="text-lg font-semibold">{t('onboarding.steps.basics.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('onboarding.steps.basics.subtitle')}</p>
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

          <div className="flex justify-end gap-2">
            <Button onClick={handleSaveBasics} disabled={savingBasics}>
              {savingBasics ? t('common.loading') : t('onboarding.next')}
            </Button>
          </div>
        </Card>
      )}

      {step === 'team' && (
        <Card className="p-6 space-y-5 bg-card/70 backdrop-blur border-border">
          <div>
            <h2 className="text-lg font-semibold">{t('onboarding.steps.team.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('onboarding.steps.team.subtitle')}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
            <Input
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder={t('onboarding.invitePlaceholder')}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as 'admin' | 'user')}
            >
              <option value="user">{t('onboarding.roleUser')}</option>
              <option value="admin">{t('onboarding.roleAdmin')}</option>
            </select>
            <Button onClick={handleInvite} disabled={savingInvite}>
              {savingInvite ? t('common.loading') : t('onboarding.addInvite')}
            </Button>
          </div>

          {invites.length > 0 && (
            <div className="rounded-md border border-border p-3 text-sm">
              {invites.map((invite) => (
                <div key={`${invite.email}-${invite.role}`} className="flex justify-between py-1">
                  <span>{invite.email}</span>
                  <span className="text-muted-foreground">{invite.role}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('basics')}>
              {t('onboarding.back')}
            </Button>
            <Button onClick={() => setStep('integrations')}>
              {t('onboarding.next')}
            </Button>
          </div>
        </Card>
      )}

      {step === 'integrations' && (
        <Card className="p-6 space-y-5 bg-card/70 backdrop-blur border-border">
          <div>
            <h2 className="text-lg font-semibold">{t('onboarding.steps.integrations.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('onboarding.steps.integrations.subtitle')}</p>
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

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('team')}>
              {t('onboarding.back')}
            </Button>
            <Button onClick={handleSaveIntegrations} disabled={savingIntegrations}>
              {savingIntegrations ? t('common.loading') : t('onboarding.next')}
            </Button>
          </div>
        </Card>
      )}

      {step === 'finish' && (
        <Card className="p-6 space-y-5 bg-card/70 backdrop-blur border-border">
          <div>
            <h2 className="text-lg font-semibold">{t('onboarding.steps.finish.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('onboarding.steps.finish.subtitle')}</p>
          </div>
          <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
            {t('onboarding.finishChecklist')}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('integrations')}>
              {t('onboarding.back')}
            </Button>
            <Button onClick={handleFinish}>{t('onboarding.finish')}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}



