import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n, isLocale } from '@/lib/i18n';
import ThemeSelector from '@/components/settings/ThemeSelector';
import LanguageSelector from '@/components/settings/LanguageSelector';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterCompanyPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const { setTenantDefaults } = useTenant();
  const { loginWithGoogle } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [language, setLanguage] = useState<typeof locale>(locale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  const showError = (msg: string) => {
    setError(msg);
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
    setTimeout(() => setError(''), 3000);
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle({
        createIfMissing: true,
        companyName: companyName || undefined,
      });
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Google signup fejlede');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyName || !adminName || !email || !password) {
      showError(t('auth.fieldsMissing'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.registerCompany({
        companyName,
        adminName,
        email,
        password,
        plan: 'starter',
      });

      // Sync session with Supabase client so Lovable Cloud can see the user
      const accessToken = api.getToken();
      const refreshToken = api.getRefreshToken();
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).catch(() => {});
      }

      setTenantDefaults({
        tenantId: response.tenant.id,
        companyName: response.tenant.name,
        joinCode: response.tenant.invite_code || undefined,
        inviteCode: response.tenant.invite_code || undefined,
        defaultLanguage: language,
        defaultTheme: theme,
      });

      navigate(`/${language}/app/dashboard`);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Oprettelse fejlede');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card/80 backdrop-blur p-8">
        <h1 className="text-2xl font-semibold">{t('auth.registerCompanyTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-2">{t('auth.registerCompanySubtitle')}</p>
        <form
          className={`mt-6 space-y-4 ${shaking ? 'form-shake' : ''}`}
          onSubmit={handleSubmit}
        >
          <Input
            placeholder={t('auth.companyName')}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={loading}
          />
          <Input
            placeholder={t('auth.adminName')}
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            disabled={loading}
          />
          <Input
            placeholder={t('auth.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <Input
            placeholder={t('auth.password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{t('language.label')}</div>
            <LanguageSelector value={language} onChange={setLanguage} />
          </div>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{t('theme.label')}</div>
            <ThemeSelector value={theme} onChange={setTheme} />
          </div>
          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('common.loading') : t('auth.createCompanyCta')}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={handleGoogleSignup}>
            {t('auth.signupWithGoogle')}
          </Button>
        </form>
        <div className="mt-6 text-sm text-center text-muted-foreground">
          {t('auth.alreadyHaveAccount')}{' '}
          <Link to={`/${locale}/auth/login`} className="text-primary underline underline-offset-4">
            {t('auth.signIn')}
          </Link>
        </div>
      </div>
    </div>
  );
}
