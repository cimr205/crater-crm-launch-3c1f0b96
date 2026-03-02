import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isLocale } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export default function OAuthCallbackPage() {
  const { completeGoogleLogin } = useAuth();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (errorParam) {
        setErrorMsg(errorDescription || errorParam);
        return;
      }

      if (!code) {
        navigate(`/${locale}/auth/login`, { replace: true });
        return;
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.session?.access_token) {
        setErrorMsg(error?.message || 'Google login fejlede. Prøv igen.');
        return;
      }

      const { needsOnboarding } = await completeGoogleLogin({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      });

      // Gate rule: route based on actual DB state
      if (needsOnboarding) {
        navigate(`/${locale}/app/onboarding`, { replace: true });
      } else {
        navigate(`/${locale}/app/dashboard`, { replace: true });
      }
    };

    run().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Ukendt fejl under Google login';
      setErrorMsg(msg);
    });
  }, [completeGoogleLogin, locale, navigate, searchParams]);

  if (errorMsg) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted/40 px-4">
        <div className="w-full max-w-md rounded-2xl border border-destructive bg-card/80 backdrop-blur p-8 text-center space-y-4">
          <p className="text-sm font-medium text-destructive">Google login fejlede</p>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <button
            className="text-sm underline text-primary"
            onClick={() => navigate(`/${locale}/auth/login`, { replace: true })}
          >
            Tilbage til login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted/40 px-4 text-sm text-muted-foreground">
      Logger dig ind med Google…
    </div>
  );
}
