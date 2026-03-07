import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card/80 backdrop-blur p-8">
        <h1 className="text-2xl font-semibold">{t('auth.joinCompanyTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-2">{t('auth.joinCompanySubtitle')}</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <Input
            placeholder={t('auth.joinCode')}
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
          />
          <Input placeholder={t('auth.name')} value={name} onChange={(event) => setName(event.target.value)} />
          <Input placeholder={t('auth.email')} value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input
            placeholder={t('auth.password')}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('common.loading') : t('auth.joinCompanyCta')}
          </Button>
        </form>
      </div>
    </div>
  );
}
