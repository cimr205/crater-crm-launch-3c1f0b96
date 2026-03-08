import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isLocale } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase sends the session tokens in the URL hash when the user clicks the reset link.
  // We need to wait for Supabase to exchange the hash tokens into an active session.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) { setError('Udfyld begge felter'); return; }
    if (password !== confirmPassword) { setError('Adgangskoderne stemmer ikke overens'); return; }
    if (password.length < 8) { setError('Adgangskoden skal være mindst 8 tegn'); return; }

    setLoading(true);
    setError('');
    try {
      const { error: supabaseError } = await supabase.auth.updateUser({ password });
      if (supabaseError) throw supabaseError;
      await supabase.auth.signOut();
      navigate(`/${locale}/auth/login`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noget gik galt. Prøv igen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 backdrop-blur p-8">
        <h1 className="text-2xl font-semibold">Ny adgangskode</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Vælg en ny adgangskode til din konto.
        </p>

        {!sessionReady ? (
          <div className="mt-6 text-sm text-muted-foreground animate-pulse">
            Verificerer link…
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <Input
              placeholder="Ny adgangskode"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <Input
              placeholder="Bekræft adgangskode"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
            {error && <p className="text-sm text-destructive font-medium">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Gemmer…' : 'Gem ny adgangskode'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
