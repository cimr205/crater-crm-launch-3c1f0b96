import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, Briefcase, Settings, UserSquare2, ShieldCheck,
  History, Bot, Megaphone, FileText, CreditCard, Clock, Palmtree, Banknote,
  UserPlus, CheckSquare, CalendarDays, ListTodo, Inbox, Mail, Building2,
  BarChart2, Send, X, Sparkles, Video, Zap, Phone, Search,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/contexts/AuthContext';

type NavItem = { href: string; labelKey: string; icon: React.ElementType };
type NavSection = { titleKey: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    titleKey: 'nav.section.crm',
    items: [
      { href: 'dashboard',           labelKey: 'nav.dashboard',      icon: LayoutDashboard },
      { href: 'crm/leads',           labelKey: 'nav.leads',          icon: Users },
      { href: 'crm/deals',           labelKey: 'nav.deals',          icon: Briefcase },
      { href: 'crm/lead-generation', labelKey: 'nav.leadGeneration', icon: Search },
      { href: 'customers',           labelKey: 'nav.customers',      icon: Users },
      { href: 'campaigns',           labelKey: 'nav.campaigns',      icon: Megaphone },
    ],
  },
  {
    titleKey: 'nav.section.finance',
    items: [
      { href: 'finance/invoices', labelKey: 'nav.invoices', icon: FileText },
      { href: 'finance/payments', labelKey: 'nav.payments', icon: CreditCard },
    ],
  },
  {
    titleKey: 'nav.section.hr',
    items: [
      { href: 'hr/employees',   labelKey: 'nav.employees',   icon: UserSquare2 },
      { href: 'hr/attendance',  labelKey: 'nav.attendance',  icon: Clock },
      { href: 'hr/vacation',    labelKey: 'nav.vacation',    icon: Palmtree },
      { href: 'hr/salary',      labelKey: 'nav.salary',      icon: Banknote },
      { href: 'hr/recruitment', labelKey: 'nav.recruitment', icon: UserPlus },
    ],
  },
  {
    titleKey: 'nav.section.productivity',
    items: [
      { href: 'tasks',    labelKey: 'nav.tasks',    icon: CheckSquare },
      { href: 'calendar', labelKey: 'nav.calendar', icon: CalendarDays },
      { href: 'todos',    labelKey: 'nav.todos',    icon: ListTodo },
    ],
  },
  {
    titleKey: 'nav.section.communication',
    items: [
      { href: 'inbox',              labelKey: 'nav.inbox',          icon: Inbox },
      { href: 'emails',             labelKey: 'nav.emails',         icon: Mail },
      { href: 'phone/calls',        labelKey: 'nav.phoneCalls',     icon: Phone },
      { href: 'phone/softphone',    labelKey: 'nav.softphone',      icon: Phone },
      { href: 'phone/cold-caller',  labelKey: 'nav.coldCaller',     icon: Phone },
      { href: 'email/campaigns',    labelKey: 'nav.emailCampaigns', icon: Send },
      { href: 'email/bulk',         labelKey: 'nav.bulkEmail',      icon: Users },
      { href: 'email/tracking',     labelKey: 'nav.emailTracking',  icon: BarChart2 },
      { href: 'meta/ads',           labelKey: 'nav.metaAds',        icon: BarChart2 },
    ],
  },
  {
    titleKey: 'nav.section.ai',
    items: [
      { href: 'ai/media',  labelKey: 'nav.aiMedia',   icon: Sparkles },
      { href: 'clowdbot',  labelKey: 'nav.clowdbot',  icon: Bot },
      { href: 'workflows', labelKey: 'nav.workflows', icon: Zap },
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
    { href: 'admin/overview',  labelKey: 'nav.admin',           icon: ShieldCheck },
    { href: 'admin/users',     labelKey: 'nav.adminUsers',      icon: Users },
    { href: 'admin/company',   labelKey: 'nav.adminCompany',    icon: Building2 },
    { href: 'admin/employees', labelKey: 'nav.adminEmployees',  icon: UserSquare2 },
    { href: 'admin/ai',        labelKey: 'nav.adminAi',         icon: Sparkles },
    { href: 'admin/phone',     labelKey: 'nav.adminPhone',      icon: Phone },
    { href: 'admin/settings',  labelKey: 'nav.adminSettings',   icon: Settings },
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
    <aside className="flex flex-col w-64 border-r border-border bg-sidebar backdrop-blur overflow-y-auto h-full">
      {/* Logo / workspace header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-[11px]">A</span>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-sidebar-foreground truncate leading-none">
              {user?.company_name || t('appName')}
            </div>
            <div className="text-[10px] text-sidebar-foreground/40 font-mono mt-0.5 leading-none">
              {t('appName')}
            </div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose}
            className="lg:hidden p-1 rounded-md hover:bg-sidebar-accent transition-colors text-sidebar-foreground/50">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {sections.map((section, si) => (
          <div key={section.titleKey} className={si > 0 ? 'mt-5' : ''}>
            <div className="px-2 mb-1">
              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/35">
                {t(section.titleKey)}
              </span>
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
                      'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors',
                      isActive
                        ? 'bg-primary/15 text-primary font-medium'
                        : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                    )}
                  >
                    <item.icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-primary' : '')} />
                    <span className="truncate">{t(item.labelKey)}</span>
                    {isActive && (
                      <span className="ml-auto w-1 h-1 rounded-full bg-primary shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-border px-3 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-semibold text-primary">
              {(user?.email?.[0] ?? '?').toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-sidebar-foreground truncate leading-none">
              {user?.email ?? '—'}
            </div>
            <div className="text-[10px] text-sidebar-foreground/40 mt-0.5 font-mono leading-none truncate">
              {user?.role ?? 'user'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex lg:flex-col w-64 shrink-0 min-h-screen">
        {sidebar}
      </div>

      {/* Mobile drawer */}
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
