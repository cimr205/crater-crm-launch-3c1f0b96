import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import LoginPage from "@/pages/auth/Login";
import RegisterCompanyPage from "@/pages/auth/RegisterCompany";
import JoinCompanyPage from "@/pages/auth/JoinCompany";
import OAuthCallbackPage from "@/pages/auth/OAuthCallback";
import DashboardPage from "@/pages/app/Dashboard";
import LeadsPage from "@/pages/app/crm/Leads";
import DealsPage from "@/pages/app/crm/Deals";
import EmployeesPage from "@/pages/app/hr/Employees";
import HistoryPage from "@/pages/app/History";
import ClowdBotPage from "@/pages/app/ClowdBot";
import CompanySettingsPage from "@/pages/app/settings/CompanySettings";
import AdminOverviewPage from "@/pages/app/admin/Overview";
import OnboardingPage from "@/pages/app/Onboarding";
import IntegrationsPage from "@/pages/app/Integrations";
import WorkflowsPage from "@/pages/app/Workflows";
import AppShell from "@/components/AppShell";
import { I18nProvider, isLocale } from "@/lib/i18n";
import { TenantProvider } from "@/contexts/TenantContext";
// onboarding redirect intentionally disabled in rebuild
import RoleGate from "@/components/RoleGate";

const queryClient = new QueryClient();

const LocaleLayout = () => {
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  return (
    <I18nProvider locale={locale}>
      <Outlet />
    </I18nProvider>
  );
};

const AppRouteLayout = () => {
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';

  return (
    <AppShell basePath={`/${locale}/app`}>
      <Outlet />
    </AppShell>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <TenantProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/en" replace />} />
              <Route path="/:locale" element={<LocaleLayout />}>
                <Route path="" element={<Navigate to="auth/login" replace />} />
                <Route path="auth/login" element={<LoginPage />} />
                <Route path="auth/register-company" element={<RegisterCompanyPage />} />
                <Route path="auth/join-company" element={<JoinCompanyPage />} />
                <Route path="auth/callback" element={<OAuthCallbackPage />} />
                <Route
                  path="app"
                  element={
                    <ProtectedRoute>
                      <AppRouteLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="onboarding" element={<OnboardingPage />} />
                  <Route path="crm/leads" element={<LeadsPage />} />
                  <Route path="crm/deals" element={<DealsPage />} />
                  <Route path="hr/employees" element={<EmployeesPage />} />
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="integrations" element={<IntegrationsPage />} />
                  <Route path="workflows" element={<WorkflowsPage />} />
                  <Route path="clowdbot" element={<ClowdBotPage />} />
                  <Route path="settings/company" element={<CompanySettingsPage />} />
                  <Route
                    path="admin/overview"
                    element={
                      <RoleGate role="global_admin">
                        <AdminOverviewPage />
                      </RoleGate>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TenantProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
