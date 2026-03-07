import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Settings,
  UserSquare2,
  ShieldCheck,
  History,
  Bot,
  Menu,
  X,
  Megaphone,
  Mail,
  CheckSquare,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { href: 'tasks', labelKey: 'nav.tasks', icon: CheckSquare },
  { href: 'crm/leads', labelKey: 'nav.leads', icon: Users },
  { href: 'crm/deals', labelKey: 'nav.deals', icon: Briefcase },
  { href: 'meta/ads', labelKey: 'nav.metaAds', icon: Megaphone },
  { href: 'email/campaigns', labelKey: 'nav.emailCampaigns', icon: Mail },
  { href: 'integrations', labelKey: 'nav.integrations', icon: Settings },
  { href: 'workflows', labelKey: 'nav.workflows', icon: Settings },
  { href: 'clowdbot', labelKey: 'nav.clowdbot', icon: Bot },
  { href: 'hr/employees', labelKey: 'nav.employees', icon: UserSquare2 },
  { href: 'history', labelKey: 'nav.history', icon: History },
  { href: 'settings/company', labelKey: 'nav.settings', icon: Settings },
];

function NavLinks({ basePath, onNavigate }: { basePath: string; onNavigate?: () => void }) {
  const location = useLocation();
  const { t } = useI18n();
  const { user } = useAuth();
  const adminItems = user?.is_global_admin ? [{ href: 'admin/overview', labelKey: 'nav.admin', icon: ShieldCheck }] : [];

  return (
    <>
      {[...navItems, ...adminItems].map((item) => {
        const path = `${basePath}/${item.href}`;
        const isActive = location.pathname.startsWith(path);
        return (
          <Link
            key={item.href}
            to={path}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <item.icon className="h-4 w-4" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </>
  );
}

export default function TenantSidebar({ basePath }: { basePath: string }) {
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 border-r border-border bg-card/80 backdrop-blur">
        <div className="p-6 border-b border-border">
          <div className="text-lg font-semibold">{t('appName')}</div>
          <div className="text-xs text-muted-foreground mt-1">{t('nav.dashboard')}</div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavLinks basePath={basePath} />
        </nav>
      </aside>

      {/* Mobile hamburger button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 rounded-lg border border-border bg-card/90 backdrop-blur p-2 shadow"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 flex flex-col w-72 max-w-[85vw] h-full border-r border-border bg-card shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="text-lg font-semibold">{t('appName')}</div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              <NavLinks basePath={basePath} onNavigate={() => setMobileOpen(false)} />
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
