import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import NotFound from "./pages/NotFound";
import LoginPage from "@/pages/auth/Login";
import SignupPage from "@/pages/auth/Signup";
import RegisterCompanyPage from "@/pages/auth/RegisterCompany";
import JoinCompanyPage from "@/pages/auth/JoinCompany";
import OAuthCallbackPage from "@/pages/auth/OAuthCallback";
import ForgotPasswordPage from "@/pages/auth/ForgotPassword";
import ResetPasswordPage from "@/pages/auth/ResetPassword";
import DashboardPage from "@/pages/app/Dashboard";
import LeadsPage from "@/pages/app/crm/Leads";
import DealsPage from "@/pages/app/crm/Deals";
import CustomersPage from "@/pages/app/Customers";
import CampaignsPage from "@/pages/app/Campaigns";
import InvoicesPage from "@/pages/app/finance/Invoices";
import PaymentsPage from "@/pages/app/finance/Payments";
import EmployeesPage from "@/pages/app/hr/Employees";
import AttendancePage from "@/pages/app/hr/Attendance";
import VacationPage from "@/pages/app/hr/Vacation";
import SalaryPage from "@/pages/app/hr/Salary";
import RecruitmentPage from "@/pages/app/hr/Recruitment";
import CalendarPage from "@/pages/app/productivity/Calendar";
import TodosPage from "@/pages/app/productivity/Todos";
import InboxPage from "@/pages/app/communication/Inbox";
import EmailsPage from "@/pages/app/communication/Emails";
import HistoryPage from "@/pages/app/History";
import ClowdBotPage from "@/pages/app/ClowdBot";
import CompanySettingsPage from "@/pages/app/settings/CompanySettings";
import AdminOverviewPage from "@/pages/app/admin/Overview";
import AdminUsersPage from "@/pages/app/admin/Users";
import AdminCompanyPage from "@/pages/app/admin/AdminCompany";
import AdminEmployeesPage from "@/pages/app/admin/AdminEmployees";
import AdminSettingsPage from "@/pages/app/admin/AdminSettings";
import OnboardingPage from "@/pages/app/Onboarding";
import IntegrationsPage from "@/pages/app/Integrations";
import WorkflowsPage from "@/pages/app/Workflows";
import MetaAdsPage from "@/pages/app/meta/MetaAds";
import EmailCampaignsPage from "@/pages/app/email/EmailCampaigns";
import BulkEmailPage from "@/pages/app/email/BulkEmail";
import EmailTrackingPage from "@/pages/app/email/EmailTracking";
import AiTasksPage from "@/pages/app/tasks/Tasks";
import AiMediaPage from "@/pages/app/ai/AiMedia";
import PhonePage from "@/pages/app/phone/PhonePage";
import CvrProspectorPage from "@/pages/app/crm/CvrProspector";
import ProspectEnginePage from "@/pages/app/crm/ProspectEngine";
import AdminAiUsagePage from "@/pages/app/admin/AiUsage";
import AppShell from "@/components/AppShell";
import { I18nProvider, isLocale } from "@/lib/i18n";
import { TenantProvider } from "@/contexts/TenantContext";
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
  <ErrorBoundary>
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
                <Route path="auth/signup" element={<SignupPage />} />
                <Route path="auth/register-company" element={<RegisterCompanyPage />} />
                <Route path="auth/join-company" element={<JoinCompanyPage />} />
                <Route path="auth/callback" element={<OAuthCallbackPage />} />
                <Route path="auth/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="auth/reset-password" element={<ResetPasswordPage />} />
                <Route
                  path="app"
                  element={
                    <ProtectedRoute>
                      <AppRouteLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route
                    path="onboarding"
                    element={
                      <ProtectedRoute requireNotOnboarded>
                        <OnboardingPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* CRM */}
                  <Route path="crm/leads" element={<LeadsPage />} />
                  <Route path="crm/deals" element={<DealsPage />} />
                  <Route path="crm/prospector" element={<CvrProspectorPage />} />
                  <Route path="crm/prospect-engine" element={<ProspectEnginePage />} />
                  <Route path="customers" element={<CustomersPage />} />
                  <Route path="campaigns" element={<CampaignsPage />} />

                  {/* Finance */}
                  <Route path="finance/invoices" element={<InvoicesPage />} />
                  <Route path="finance/payments" element={<PaymentsPage />} />

                  {/* HR */}
                  <Route path="hr/employees" element={<EmployeesPage />} />
                  <Route path="hr/attendance" element={<AttendancePage />} />
                  <Route path="hr/vacation" element={<VacationPage />} />
                  <Route path="hr/salary" element={<SalaryPage />} />
                  <Route path="hr/recruitment" element={<RecruitmentPage />} />

                  {/* Productivity */}
                  <Route path="tasks" element={<AiTasksPage />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="todos" element={<TodosPage />} />

                  {/* Communication */}
                  <Route path="inbox" element={<InboxPage />} />
                  <Route path="emails" element={<EmailsPage />} />
                  <Route path="phone/calls" element={<PhonePage />} />

                  {/* AI */}
                  <Route path="ai/media" element={<AiMediaPage />} />

                  {/* System */}
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="integrations" element={<IntegrationsPage />} />
                  <Route path="workflows" element={<WorkflowsPage />} />
                  <Route path="clowdbot" element={<ClowdBotPage />} />
                  <Route path="meta/ads" element={<MetaAdsPage />} />
                  <Route path="email/campaigns" element={<EmailCampaignsPage />} />
                  <Route path="email/bulk" element={<BulkEmailPage />} />
                  <Route path="email/tracking" element={<EmailTrackingPage />} />
                  <Route path="settings/company" element={<CompanySettingsPage />} />

                  {/* Admin */}
                  <Route
                    path="admin/overview"
                    element={
                      <RoleGate role="global_admin">
                        <AdminOverviewPage />
                      </RoleGate>
                    }
                  />
                  <Route
                    path="admin/users"
                    element={
                      <RoleGate role="global_admin">
                        <AdminUsersPage />
                      </RoleGate>
                    }
                  />
                  <Route
                    path="admin/company"
                    element={
                      <RoleGate role="global_admin">
                        <AdminCompanyPage />
                      </RoleGate>
                    }
                  />
                  <Route
                    path="admin/employees"
                    element={
                      <RoleGate role="global_admin">
                        <AdminEmployeesPage />
                      </RoleGate>
                    }
                  />
                  <Route
                    path="admin/ai"
                    element={
                      <RoleGate role="global_admin">
                        <AdminAiUsagePage />
                      </RoleGate>
                    }
                  />
                  <Route
                    path="admin/settings"
                    element={
                      <RoleGate role="global_admin">
                        <AdminSettingsPage />
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
  </ErrorBoundary>
);

export default App;
