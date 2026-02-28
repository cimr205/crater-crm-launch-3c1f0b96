import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n, isLocale } from '@/lib/i18n';

export default function LoginPage() {
  const { t } = useI18n();
  const { login, loginWithGoogle } = useAuth();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const navigate = useNavigate();
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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Google login fejlede');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      showError(t('auth.fieldsMissing'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate(`/${locale}/app/dashboard`);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Login fejlede');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 backdrop-blur p-8">
        <h1 className="text-2xl font-semibold">{t('auth.loginTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-2">{t('auth.loginSubtitle')}</p>
        <form
          className={`mt-6 space-y-4 ${shaking ? 'form-shake' : ''}`}
          onSubmit={handleSubmit}
        >
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
            {loading ? t('common.loading') : t('auth.loginCta')}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={handleGoogleLogin}>
            {t('auth.loginWithGoogle')}
          </Button>
        </form>
        <div className="mt-6 flex flex-col gap-2 text-sm text-center text-muted-foreground">
          <span>
            {t('auth.noAccount')}{' '}
            <Link to={`/${locale}/auth/register-company`} className="text-primary underline underline-offset-4">
              {t('auth.createCompany')}
            </Link>
          </span>
          <span>
            {t('auth.haveJoinCode')}{' '}
            <Link to={`/${locale}/auth/join-company`} className="text-primary underline underline-offset-4">
              {t('auth.useJoinCode')}
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
