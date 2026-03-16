import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { api, TenantSettings, type PhoneProvision } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ImagePlus, X, Phone, Loader2, KeyRound, CheckCircle2 } from 'lucide-react';
import type { TwilioSettings } from '@/lib/api';

const LOGO_KEY = 'crater_invoice_logo';

const paymentStatuses = ['pending', 'active', 'past_due', 'cancelled', 'trial'];

export default function CompanySettingsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();

  const [tenant, setTenant] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>(() => localStorage.getItem(LOGO_KEY) || '');
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [phoneProvision, setPhoneProvision] = useState<PhoneProvision | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(true);
  const [phoneProvisioning, setPhoneProvisioning] = useState(false);
  const [phoneReleasing, setPhoneReleasing] = useState(false);

  const [twilioSettings, setTwilioSettings] = useState<TwilioSettings | null>(null);
  const [twilioLoading, setTwilioLoading] = useState(true);
  const [twilioSaving, setTwilioSaving] = useState(false);
  const [twilioDeleting, setTwilioDeleting] = useState(false);
  const [twilioForm, setTwilioForm] = useState({
    account_sid: '',
    api_key: '',
    api_secret: '',
    twiml_app_sid: '',
    phone_number: '',
    auth_token: '',
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 600_000) { toast({ title: 'Logo må højst være 600 KB', variant: 'destructive' }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setLogoUrl(b64);
      localStorage.setItem(LOGO_KEY, b64);
      toast({ title: 'Logo gemt — vises på fakturaer' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLogoRemove = () => {
    setLogoUrl('');
    localStorage.removeItem(LOGO_KEY);
    toast({ title: 'Logo fjernet' });
  };

  useEffect(() => {
    let active = true;

    api
      .getCompanySettings()
      .then((response) => {
        if (!active) return;
        setTenant(response.tenant);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    api
      .getPhoneProvision()
      .then((res) => {
        if (!active) return;
        setPhoneProvision(res.data);
      })
      .catch(() => setPhoneProvision(null))
      .finally(() => { if (active) setPhoneLoading(false); });

    api
      .getTwilioSettings()
      .then((data) => {
        if (!active) return;
        setTwilioSettings(data);
        if (data.is_configured) {
          setTwilioForm(f => ({
            ...f,
            account_sid: data.account_sid ?? '',
            twiml_app_sid: data.twiml_app_sid ?? '',
            phone_number: data.phone_number ?? '',
          }));
        }
      })
      .catch(() => setTwilioSettings(null))
      .finally(() => { if (active) setTwilioLoading(false); });

    return () => {
      active = false;
    };
  }, []);

  const handleProvision = async () => {
    setPhoneProvisioning(true);
    try {
      const res = await api.provisionPhoneNumber();
      setPhoneProvision(res.data);
      toast({ title: `Telefonnummer aktiveret: ${res.data.phone_number}` });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Kunne ikke aktivere nummer', variant: 'destructive' });
    } finally {
      setPhoneProvisioning(false);
    }
  };

  const handleRelease = async () => {
    if (!confirm('Er du sikker? Dette frigiver nummeret permanent.')) return;
    setPhoneReleasing(true);
    try {
      await api.releasePhoneNumber();
      setPhoneProvision(prev => prev ? { ...prev, phone_number: null, active: false, minutes_used: 0 } : null);
      toast({ title: 'Telefonnummer frigivet' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Kunne ikke frigive nummer', variant: 'destructive' });
    } finally {
      setPhoneReleasing(false);
    }
  };

  const handleSaveTwilio = async () => {
    if (!twilioForm.account_sid || !twilioForm.api_key || !twilioForm.api_secret || !twilioForm.twiml_app_sid || !twilioForm.phone_number) {
      toast({ title: 'Udfyld alle Twilio-felter', variant: 'destructive' });
      return;
    }
    setTwilioSaving(true);
    try {
      await api.saveTwilioSettings(twilioForm);
      const updated = await api.getTwilioSettings();
      setTwilioSettings(updated);
      toast({ title: 'Twilio-indstillinger gemt' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Kunne ikke gemme', variant: 'destructive' });
    } finally {
      setTwilioSaving(false);
    }
  };

  const handleDeleteTwilio = async () => {
    if (!confirm('Er du sikker? Dette fjerner alle Twilio-legitimationsoplysninger for din virksomhed.')) return;
    setTwilioDeleting(true);
    try {
      await api.deleteTwilioSettings();
      setTwilioSettings(null);
      setTwilioForm({ account_sid: '', api_key: '', api_secret: '', twiml_app_sid: '', phone_number: '', auth_token: '' });
      toast({ title: 'Twilio-integration frakobles' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Kunne ikke frakoble', variant: 'destructive' });
    } finally {
      setTwilioDeleting(false);
    }
  };

  const isOwner = !!user && (user.role === 'owner' || user.is_global_admin);

  const handleSave = async () => {
    if (!tenant) return;

    setSaving(true);
    try {
      const response = await api.updateCompanySettings({
        name: tenant.name,
        cvr: tenant.cvr || null,
        address: tenant.address || null,
        country: tenant.country || null,
        phone: tenant.phone || null,
        email: tenant.email || null,
        plan: tenant.plan,
        user_limit: tenant.user_limit || null,
        payment_status: tenant.payment_status,
      });

      setTenant(response.tenant);
      toast({ title: t('common.save') });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateInviteCode = async () => {
    if (!tenant) return;

    setRegeneratingCode(true);
    try {
      const response = await api.regenerateInviteCode();
      setTenant({ ...tenant, invite_code: response.invite_code });
      toast({ title: t('settings.inviteRegenerated') });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not regenerate code', variant: 'destructive' });
    } finally {
      setRegeneratingCode(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  if (!tenant) {
    return <div className="text-sm text-destructive">{t('settings.loadError')}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('settings.companyTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.companySubtitle')}</p>
      </div>

      <Card className="p-6 space-y-4 bg-card/70 backdrop-blur border-border">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.companyNameLabel')}</div>
            <Input value={tenant.name || ''} onChange={(event) => setTenant({ ...tenant, name: event.target.value })} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.cvrLabel')}</div>
            <Input value={tenant.cvr || ''} onChange={(event) => setTenant({ ...tenant, cvr: event.target.value })} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.addressLabel')}</div>
            <Input
              value={tenant.address || ''}
              onChange={(event) => setTenant({ ...tenant, address: event.target.value })}
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.countryLabel')}</div>
            <Input
              value={tenant.country || ''}
              onChange={(event) => setTenant({ ...tenant, country: event.target.value })}
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.phoneLabel')}</div>
            <Input value={tenant.phone || ''} onChange={(event) => setTenant({ ...tenant, phone: event.target.value })} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.emailLabel')}</div>
            <Input value={tenant.email || ''} onChange={(event) => setTenant({ ...tenant, email: event.target.value })} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.planLabel')}</div>
            <Input
              value={tenant.plan || ''}
              onChange={(event) => setTenant({ ...tenant, plan: event.target.value })}
              disabled={!isOwner}
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.userLimitLabel')}</div>
            <Input
              type="number"
              value={tenant.user_limit || ''}
              onChange={(event) =>
                setTenant({ ...tenant, user_limit: event.target.value ? Number(event.target.value) : null })
              }
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.paymentStatusLabel')}</div>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={tenant.payment_status || 'pending'}
              onChange={(event) => setTenant({ ...tenant, payment_status: event.target.value })}
              disabled={!isOwner}
            >
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.companyStatusLabel')}</div>
            <div className="h-10 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center">
              {tenant.is_active ? t('settings.statusActive') : t('settings.statusInactive')}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.createdLabel')}</div>
            <div className="h-10 rounded-md border border-input bg-muted/40 px-3 text-sm flex items-center">
              {tenant.created_at ? new Date(tenant.created_at).toLocaleString() : '—'}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">{t('settings.inviteCodeLabel')}</div>
            <div className="flex gap-2">
              <Input value={tenant.invite_code || 'Hidden'} readOnly />
              {isOwner && (
                <Button variant="outline" onClick={handleRegenerateInviteCode} disabled={regeneratingCode}>
                  {regeneratingCode ? t('common.loading') : t('settings.regenerate')}
                </Button>
              )}
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? t('common.loading') : t('settings.updateCta')}
        </Button>
      </Card>

      {/* Phone provisioning card */}
      <Card className="p-6 space-y-4 bg-card/70 backdrop-blur border-border">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold">{t('phone.provisionTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('phone.provisionSubtitle')}</p>
          </div>
        </div>

        {phoneLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : phoneProvision?.active && phoneProvision.phone_number ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">{t('phone.yourNumber')}</div>
                <div className="text-lg font-semibold tracking-wide">{phoneProvision.phone_number}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground mb-0.5">{t('phone.planLabel')}: {phoneProvision.plan}</div>
                <div className="text-xs text-muted-foreground">{t('phone.minuteLimit')}: {phoneProvision.minutes_limit} min/md</div>
              </div>
            </div>

            {/* Usage bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('phone.usageThisMonth')}</span>
                <span className={phoneProvision.minutes_used / phoneProvision.minutes_limit > 0.8 ? 'text-destructive font-medium' : 'text-foreground'}>
                  {phoneProvision.minutes_used} / {phoneProvision.minutes_limit} min
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    phoneProvision.minutes_used / phoneProvision.minutes_limit > 0.8
                      ? 'bg-destructive'
                      : phoneProvision.minutes_used / phoneProvision.minutes_limit > 0.6
                      ? 'bg-yellow-500'
                      : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, (phoneProvision.minutes_used / phoneProvision.minutes_limit) * 100)}%` }}
                />
              </div>
              {phoneProvision.minutes_used / phoneProvision.minutes_limit > 0.8 && (
                <div className="text-xs text-destructive">{t('phone.usageWarning')}</div>
              )}
            </div>

            <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleRelease} disabled={phoneReleasing}>
              {phoneReleasing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('phone.releaseNumber')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('phone.noNumberYet')}</p>
            <Button onClick={handleProvision} disabled={phoneProvisioning} className="gap-2">
              {phoneProvisioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              {phoneProvisioning ? t('common.loading') : t('phone.activateNumber')}
            </Button>
          </div>
        )}
      </Card>

      {/* Twilio Integration card */}
      <Card className="p-6 space-y-4 bg-card/70 backdrop-blur border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold">Twilio Integration</h2>
              <p className="text-sm text-muted-foreground">Tilslut din egen Twilio-konto for at bruge Softphone og Cold Caller.</p>
            </div>
          </div>
          {twilioSettings?.is_configured && (
            <div className="flex items-center gap-1.5 text-sm text-emerald-500 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Tilsluttet
            </div>
          )}
        </div>

        {twilioLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Indlæser…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Account SID</div>
                <Input
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={twilioForm.account_sid}
                  onChange={e => setTwilioForm(f => ({ ...f, account_sid: e.target.value }))}
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Auth Token <span className="text-muted-foreground/60">(kun nødvendigt ved opkald via REST API)</span></div>
                <Input
                  type="password"
                  placeholder="••••••••••••••••"
                  value={twilioForm.auth_token}
                  onChange={e => setTwilioForm(f => ({ ...f, auth_token: e.target.value }))}
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">API Key SID</div>
                <Input
                  placeholder="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={twilioForm.api_key}
                  onChange={e => setTwilioForm(f => ({ ...f, api_key: e.target.value }))}
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">API Secret</div>
                <Input
                  type="password"
                  placeholder="••••••••••••••••"
                  value={twilioForm.api_secret}
                  onChange={e => setTwilioForm(f => ({ ...f, api_secret: e.target.value }))}
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">TwiML App SID</div>
                <Input
                  placeholder="APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={twilioForm.twiml_app_sid}
                  onChange={e => setTwilioForm(f => ({ ...f, twiml_app_sid: e.target.value }))}
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Twilio telefonnummer (E.164)</div>
                <Input
                  placeholder="+4500000000"
                  value={twilioForm.phone_number}
                  onChange={e => setTwilioForm(f => ({ ...f, phone_number: e.target.value }))}
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Opsætningsvejledning</p>
              <p>1. Opret en <strong>TwiML App</strong> i Twilio Console → Voice Request URL: <code className="bg-muted px-1 rounded">https://&lt;din-server&gt;/voice/outgoing?company_id=&lt;id&gt;</code></p>
              <p>2. Angiv dette som webhook på dit Twilio-nummer: <code className="bg-muted px-1 rounded">https://&lt;din-server&gt;/voice/incoming?company_id=&lt;id&gt;</code></p>
              <p>3. Gem dine legitimationsoplysninger herunder — de bruges til token-generering i browseren.</p>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleSaveTwilio} disabled={twilioSaving}>
                {twilioSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Gem Twilio-indstillinger
              </Button>
              {twilioSettings?.is_configured && (
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={handleDeleteTwilio}
                  disabled={twilioDeleting}
                >
                  {twilioDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Frakobl Twilio
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Logo card */}
      <Card className="p-6 space-y-4 bg-card/70 backdrop-blur border-border">
        <div>
          <h2 className="text-base font-semibold">Virksomhedslogo</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Logoet vises øverst på alle fakturaer du udskriver eller sender.</p>
        </div>
        {logoUrl ? (
          <div className="flex items-center gap-4">
            <div className="border rounded-lg p-3 bg-white">
              <img src={logoUrl} alt="Virksomhedslogo" className="h-16 max-w-[240px] object-contain" />
            </div>
            <div className="space-y-2">
              <Button size="sm" variant="outline" onClick={() => logoInputRef.current?.click()}>
                <ImagePlus className="h-4 w-4 mr-2" />Skift logo
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive block" onClick={handleLogoRemove}>
                <X className="h-4 w-4 mr-2" />Fjern logo
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors w-full py-10 cursor-pointer"
            onClick={() => logoInputRef.current?.click()}
          >
            <ImagePlus className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Klik for at uploade logo</p>
              <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG eller SVG · Maks 600 KB</p>
            </div>
          </button>
        )}
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="sr-only"
          onChange={handleLogoUpload}
        />
      </Card>
    </div>
  );
}
