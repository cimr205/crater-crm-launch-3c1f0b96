import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isLocale, useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const INDUSTRY_OPTIONS = [
  'Teknologi & software',
  'Marketing & reklame',
  'Handel & e-commerce',
  'Konsulentvirksomhed',
  'Sundhed & velfærd',
  'Uddannelse',
  'Finans & regnskab',
  'Produktion & industri',
  'Ejendom & byggeri',
  'Andet',
];

const SIZE_OPTIONS = ['1–5', '6–20', '21–50', '51–200', '200+'];

const GOAL_OPTIONS = [
  'Skaffe flere kunder',
  'Øge omsætningen',
  'Automatisere arbejdsgange',
  'Forbedre kundeservice',
  'Styrke teamsamarbejdet',
  'Få bedre overblik over data',
];

type Step = 1 | 2;

export default function OnboardingPage() {
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const navigate = useNavigate();
  const { refreshGate, user } = useAuth();
  const { t } = useI18n();

  const [step, setStep] = useState<Step>(1);
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [size, setSize] = useState('');
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const step1Valid = companyName.trim().length >= 2 && industry;
  const step2Valid = size && goal;

  const handleFinish = async () => {
    if (!step1Valid || !step2Valid) return;

    setSaving(true);
    setError('');
    try {
      await api.completeOnboarding({
        company_name: companyName.trim(),
        industry,
        size,
        goal,
      });
      // Ensure the user has 'owner' role in the DB.
      // The Railway backend should handle this, but we defensively upsert
      // via Supabase to cover edge cases (backend lag, first-user fallback).
      if (user?.id) {
        await supabase
          .from('users')
          .update({ role: 'owner' })
          .eq('id', user.id)
          .then(() => undefined) // ignore RLS / 404 errors silently
          .catch(() => undefined);
      }
      // Refresh gate so ProtectedRoute allows /app
      await refreshGate();
      navigate(`/${locale}/app/dashboard`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('onboarding.errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted/40 px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold">{t('onboarding.welcome')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('onboarding.stepProgress').replace('{{step}}', String(step))}
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: step === 1 ? '50%' : '100%' }}
          />
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <Card className="p-6 space-y-5 bg-card/70 backdrop-blur border-border">
            <div>
              <h2 className="text-lg font-semibold">{t('onboarding.step1Title')}</h2>
              <p className="text-sm text-muted-foreground">{t('onboarding.step1Subtitle')}</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">
                  {t('onboarding.companyNameLabel')} <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder={t('onboarding.companyNamePlaceholder')}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">
                  {t('onboarding.industryLabel')} <span className="text-destructive">*</span>
                </label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                >
                  <option value="">{t('onboarding.industryPlaceholder')}</option>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!step1Valid}>
                {t('onboarding.nextArrow')}
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <Card className="p-6 space-y-5 bg-card/70 backdrop-blur border-border">
            <div>
              <h2 className="text-lg font-semibold">{t('onboarding.step2Title')}</h2>
              <p className="text-sm text-muted-foreground">{t('onboarding.step2Subtitle')}</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">
                  {t('onboarding.sizeLabel')} <span className="text-destructive">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSize(opt)}
                      className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                        size === opt
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-input bg-background hover:bg-muted'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">
                  {t('onboarding.goalLabel')} <span className="text-destructive">*</span>
                </label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                >
                  <option value="">{t('onboarding.goalPlaceholder')}</option>
                  {GOAL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={saving}>
                {t('onboarding.backArrow')}
              </Button>
              <Button onClick={handleFinish} disabled={!step2Valid || saving}>
                {saving ? t('onboarding.saving') : t('onboarding.done')}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
