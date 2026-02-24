import { useEffect } from 'react';
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

  useEffect(() => {
    const run = async () => {
      const code = searchParams.get('code');
      if (!code) {
        navigate(`/${locale}/auth/login`, { replace: true });
        return;
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.session?.access_token) {
        navigate(`/${locale}/auth/login`, { replace: true });
        return;
      }

      await completeGoogleLogin({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        createIfMissing: searchParams.get('createIfMissing') === '1',
        companyName: searchParams.get('companyName') || undefined,
      });

      navigate(`/${locale}/app/dashboard`, { replace: true });
    };

    run().catch(() => {
      navigate(`/${locale}/auth/login`, { replace: true });
    });
  }, [completeGoogleLogin, locale, navigate, searchParams]);

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background to-muted/40 px-4 text-sm text-muted-foreground">
      Signing you in with Google...
    </div>
  );
}
