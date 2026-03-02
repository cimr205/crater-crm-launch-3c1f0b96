import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isLocale } from '@/lib/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

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
  const { refreshGate } = useAuth();

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
      // Refresh gate so ProtectedRoute allows /app
      await refreshGate();
      navigate(`/${locale}/app/dashboard`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noget gik galt. Prøv igen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted/40 px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold">Velkommen – opsæt din virksomhed</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trin {step} af 2
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
              <h2 className="text-lg font-semibold">Om virksomheden</h2>
              <p className="text-sm text-muted-foreground">Fortæl os lidt om dit firma</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">
                  Virksomhedens navn <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="f.eks. Acme ApS"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">
                  Branche <span className="text-destructive">*</span>
                </label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                >
                  <option value="">Vælg branche…</option>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!step1Valid}>
                Næste →
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <Card className="p-6 space-y-5 bg-card/70 backdrop-blur border-border">
            <div>
              <h2 className="text-lg font-semibold">Størrelse & mål</h2>
              <p className="text-sm text-muted-foreground">Hjælper os med at skræddersy oplevelsen</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">
                  Antal ansatte <span className="text-destructive">*</span>
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
                  Primært mål <span className="text-destructive">*</span>
                </label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                >
                  <option value="">Vælg dit primære mål…</option>
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
                ← Tilbage
              </Button>
              <Button onClick={handleFinish} disabled={!step2Valid || saving}>
                {saving ? 'Gemmer…' : 'Færdig'}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
