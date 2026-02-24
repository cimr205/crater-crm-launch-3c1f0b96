import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n, isLocale } from '@/lib/i18n';
import ThemeSelector from '@/components/settings/ThemeSelector';
import LanguageSelector from '@/components/settings/LanguageSelector';
import { api } from '@/lib/api';
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

  const handleGoogleSignup = async () => {
    setLoading(true);
    try {
      await loginWithGoogle({
        createIfMissing: true,
        companyName: companyName || undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await api.registerCompany({
        companyName,
        adminName,
        email,
        password,
        plan: 'starter',
      });

      setTenantDefaults({
        tenantId: response.tenant.id,
        companyName: response.tenant.name,
        joinCode: response.tenant.invite_code || undefined,
        inviteCode: response.tenant.invite_code || undefined,
        defaultLanguage: language,
        defaultTheme: theme,
      });

      navigate(`/${language}/app/dashboard`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card/80 backdrop-blur p-8">
        <h1 className="text-2xl font-semibold">{t('auth.registerCompanyTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-2">{t('auth.registerCompanySubtitle')}</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <Input
            placeholder={t('auth.companyName')}
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
          />
          <Input
            placeholder={t('auth.adminName')}
            value={adminName}
            onChange={(event) => setAdminName(event.target.value)}
          />
          <Input
            placeholder={t('auth.email')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            placeholder={t('auth.password')}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{t('language.label')}</div>
            <LanguageSelector value={language} onChange={setLanguage} />
          </div>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{t('theme.label')}</div>
            <ThemeSelector value={theme} onChange={setTheme} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('common.loading') : t('auth.createCompanyCta')}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={handleGoogleSignup}>
            {t('auth.signupWithGoogle')}
          </Button>
        </form>
      </div>
    </div>
  );
}

