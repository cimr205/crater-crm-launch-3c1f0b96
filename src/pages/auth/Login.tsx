import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n, isLocale } from '@/lib/i18n';

export default function LoginPage() {
  const { t } = useI18n();
  const { login } = useAuth();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate(`/${locale}/app/dashboard`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 backdrop-blur p-8">
        <h1 className="text-2xl font-semibold">{t('auth.loginTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-2">{t('auth.loginSubtitle')}</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('common.loading') : t('auth.loginCta')}
          </Button>
        </form>
      </div>
    </div>
  );
}




