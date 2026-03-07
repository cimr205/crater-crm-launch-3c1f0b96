import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { isLocale } from '@/lib/i18n';

export default function SignupPage() {
  const { signup } = useAuth();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  const showError = (msg: string) => {
    setError(msg);
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
    setTimeout(() => setError(''), 4000);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      showError('Udfyld alle felter');
      return;
    }
    if (password !== confirmPassword) {
      showError('Adgangskoderne stemmer ikke overens');
      return;
    }
    if (password.length < 8) {
      showError('Adgangskoden skal være mindst 8 tegn');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await signup(name, email, password);
      navigate(`/${locale}/app/onboarding`);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Oprettelse fejlede');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 backdrop-blur p-8">
        <h1 className="text-2xl font-semibold">Opret konto</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Kom i gang – opsæt din virksomhed i næste trin
        </p>
        <form
          className={`mt-6 space-y-4 ${shaking ? 'form-shake' : ''}`}
          onSubmit={handleSubmit}
        >
          <Input
            placeholder="Navn"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <Input
            placeholder="Adgangskode"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <Input
            placeholder="Bekræft adgangskode"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Opretter...' : 'Opret konto'}
          </Button>
        </form>
        <p className="mt-6 text-sm text-center text-muted-foreground">
          Har du allerede en konto?{' '}
          <Link
            to={`/${locale}/auth/login`}
            className="text-primary underline underline-offset-4"
          >
            Log ind
          </Link>
        </p>
      </div>
    </div>
  );
}
