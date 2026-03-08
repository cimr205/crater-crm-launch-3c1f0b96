import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isLocale } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Indtast din e-mail'); return; }
    setLoading(true);
    setError('');
    try {
      const redirectTo = `${window.location.origin}/${locale}/auth/reset-password`;
      const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (supabaseError) throw supabaseError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noget gik galt. Prøv igen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 backdrop-blur p-8">
        <h1 className="text-2xl font-semibold">Glemt adgangskode</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Indtast din e-mail, så sender vi dig et link til at nulstille din adgangskode.
        </p>

        {sent ? (
          <div className="mt-6 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-300">
            Tjek din indbakke — vi har sendt et nulstillingslink til <strong>{email}</strong>.
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <Input
              placeholder="Din e-mail"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              autoFocus
            />
            {error && <p className="text-sm text-destructive font-medium">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sender…' : 'Send nulstillingslink'}
            </Button>
          </form>
        )}

        <div className="mt-6 text-sm text-center text-muted-foreground">
          <Link to={`/${locale}/auth/login`} className="text-primary underline underline-offset-4">
            ← Tilbage til login
          </Link>
        </div>
      </div>
    </div>
  );
}
