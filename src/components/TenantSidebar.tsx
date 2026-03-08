import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, Briefcase, Settings, UserSquare2, ShieldCheck,
  History, Bot, Megaphone, FileText, CreditCard, Clock, Palmtree, Banknote,
  UserPlus, CheckSquare, CalendarDays, ListTodo, Inbox, Mail, Building2,
  BarChart2, Send, X, Sparkles, Video,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/contexts/AuthContext';

type NavItem = { href: string; labelKey: string; icon: React.ElementType };
type NavSection = { titleKey: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    titleKey: 'nav.section.crm',
    items: [
      { href: 'dashboard',    labelKey: 'nav.dashboard',   icon: LayoutDashboard },
      { href: 'crm/leads',    labelKey: 'nav.leads',       icon: Users },
      { href: 'crm/deals',    labelKey: 'nav.deals',       icon: Briefcase },
      { href: 'customers',    labelKey: 'nav.customers',   icon: Users },
      { href: 'campaigns',    labelKey: 'nav.campaigns',   icon: Megaphone },
    ],
  },
  {
    titleKey: 'nav.section.finance',
    items: [
      { href: 'finance/invoices',  labelKey: 'nav.invoices',  icon: FileText },
      { href: 'finance/payments',  labelKey: 'nav.payments',  icon: CreditCard },
    ],
  },
  {
    titleKey: 'nav.section.hr',
    items: [
      { href: 'hr/employees',    labelKey: 'nav.employees',   icon: UserSquare2 },
      { href: 'hr/attendance',   labelKey: 'nav.attendance',  icon: Clock },
      { href: 'hr/vacation',     labelKey: 'nav.vacation',    icon: Palmtree },
      { href: 'hr/salary',       labelKey: 'nav.salary',      icon: Banknote },
      { href: 'hr/recruitment',  labelKey: 'nav.recruitment', icon: UserPlus },
    ],
  },
  {
    titleKey: 'nav.section.productivity',
    items: [
      { href: 'tasks',     labelKey: 'nav.tasks',    icon: CheckSquare },
      { href: 'calendar',  labelKey: 'nav.calendar', icon: CalendarDays },
      { href: 'todos',     labelKey: 'nav.todos',    icon: ListTodo },
    ],
  },
  {
    titleKey: 'nav.section.communication',
    items: [
      { href: 'inbox',            labelKey: 'nav.inbox',          icon: Inbox },
      { href: 'emails',           labelKey: 'nav.emails',         icon: Mail },
      { href: 'email/campaigns',  labelKey: 'nav.emailCampaigns', icon: Send },
      { href: 'email/bulk',       labelKey: 'nav.bulkEmail',      icon: Users },
      { href: 'meta/ads',         labelKey: 'nav.metaAds',        icon: BarChart2 },
    ],
  },
  {
    titleKey: 'nav.section.ai',
    items: [
      { href: 'ai/media',  labelKey: 'nav.aiMedia',  icon: Sparkles },
      { href: 'clowdbot',  labelKey: 'nav.clowdbot', icon: Bot },
      { href: 'workflows', labelKey: 'nav.workflows', icon: Video },
    ],
  },
  {
    titleKey: 'nav.section.system',
    items: [
      { href: 'history',          labelKey: 'nav.history',      icon: History },
      { href: 'integrations',     labelKey: 'nav.integrations', icon: Settings },
      { href: 'settings/company', labelKey: 'nav.settings',     icon: Settings },
    ],
  },
];

const adminSection: NavSection = {
  titleKey: 'nav.section.admin',
  items: [
    { href: 'admin/overview',   labelKey: 'nav.admin',           icon: ShieldCheck },
    { href: 'admin/users',      labelKey: 'nav.adminUsers',      icon: Users },
    { href: 'admin/company',    labelKey: 'nav.adminCompany',    icon: Building2 },
    { href: 'admin/employees',  labelKey: 'nav.adminEmployees',  icon: UserSquare2 },
    { href: 'admin/ai',         labelKey: 'nav.adminAi',         icon: Sparkles },
    { href: 'admin/settings',   labelKey: 'nav.adminSettings',   icon: Settings },
  ],
};

interface Props {
  basePath: string;
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function TenantSidebar({ basePath, mobileOpen, onClose }: Props) {
  const location = useLocation();
  const { t } = useI18n();
  const { user } = useAuth();

  const sections = user?.is_global_admin ? [...navSections, adminSection] : navSections;

  const sidebar = (
    <aside className="flex flex-col w-64 border-r border-border bg-card/95 backdrop-blur overflow-y-auto h-full">
      <div className="p-6 border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">{t('appName')}</div>
          <div className="text-xs text-muted-foreground mt-1">{user?.company_name || '—'}</div>
        </div>
        {/* Close button — only visible on mobile */}
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-4 pb-6">
        {sections.map((section) => (
          <div key={section.titleKey}>
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              {t(section.titleKey)}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const path = `${basePath}/${item.href}`;
                const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`);
                return (
                  <Link
                    key={item.href}
                    to={path}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );

  return (
    <>
      {/* Desktop: always visible */}
      <div className="hidden lg:flex lg:flex-col w-64 shrink-0 min-h-screen">
        {sidebar}
      </div>

      {/* Mobile: slide-in drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col w-64 transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebar}
      </div>
    </>
  );
}
