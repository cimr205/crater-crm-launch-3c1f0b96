import { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { isLocale } from '@/lib/i18n';

interface ProtectedRouteProps {
  children: ReactNode;
  /** If true, redirects to /app when user IS onboarded (used on /onboarding) */
  requireNotOnboarded?: boolean;
}

export function ProtectedRoute({ children, requireNotOnboarded = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, needsOnboarding } = useAuth();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';

  // Wait until both session AND gate status are resolved
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/${locale}/auth/login`} replace />;
  }

  // Gate rule: not onboarded → /onboarding
  if (!requireNotOnboarded && needsOnboarding) {
    return <Navigate to={`/${locale}/app/onboarding`} replace />;
  }

  // Gate rule for onboarding page: already onboarded → /app/dashboard
  if (requireNotOnboarded && !needsOnboarding) {
    return <Navigate to={`/${locale}/app/dashboard`} replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
