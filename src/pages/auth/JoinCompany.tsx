import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n, isLocale } from '@/lib/i18n';
import { api } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';

export default function JoinCompanyPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const { setTenantDefaults } = useTenant();
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  const showError = (msg: string) => {
    setError(msg);
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
    setTimeout(() => setError(''), 3000);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!joinCode || !name || !email || !password) {
      showError(t('auth.fieldsMissing'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.joinCompany({ invitationCode: joinCode, name, email, password });

      setTenantDefaults({
        tenantId: response.tenant.id,
        companyName: response.tenant.name,
        joinCode: response.tenant.invite_code || undefined,
        inviteCode: response.tenant.invite_code || undefined,
        defaultLanguage: locale,
        defaultTheme: 'light',
      });

      navigate(`/${locale}/app/dashboard`);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Tilmelding fejlede');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card/80 backdrop-blur p-8">
        <h1 className="text-2xl font-semibold">{t('auth.joinCompanyTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-2">{t('auth.joinCompanySubtitle')}</p>
        <form
          className={`mt-6 space-y-4 ${shaking ? 'form-shake' : ''}`}
          onSubmit={handleSubmit}
        >
          <Input
            placeholder={t('auth.joinCode')}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            disabled={loading}
          />
          <Input
            placeholder={t('auth.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
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
          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('common.loading') : t('auth.joinCompanyCta')}
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
