import { Menu, Search, LogOut, Bell } from 'lucide-react';
import { useI18n, isLocale } from '@/lib/i18n';
import LanguagePicker from '@/components/LanguagePicker';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import { openCommandPalette } from '@/components/CommandPalette';

interface Props {
  onMenuToggle?: () => void;
}

export default function Topbar({ onMenuToggle }: Props) {
  const { t } = useI18n();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';

  return (
    <header className="h-14 flex items-center justify-between gap-3 border-b border-border bg-background/90 backdrop-blur-xl px-4 lg:px-5 shrink-0">
      {/* Mobile menu toggle */}
      <button
        className="lg:hidden p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0 text-muted-foreground"
        onClick={onMenuToggle}
        aria-label="Åbn menu"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      {/* Search / command palette */}
      <button
        className="flex items-center gap-2.5 flex-1 max-w-xs rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
        onClick={openCommandPalette}
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 hidden sm:block">{t('common.search') || 'Søg eller hop til...'}</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] border border-border rounded-md px-1.5 py-0.5 font-mono bg-background/80 text-muted-foreground/70">
          ⌘K
        </kbd>
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <LanguagePicker />

        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>

        <div className="w-px h-5 bg-border mx-0.5" />

        <button
          title={t('common.signOut') || 'Log ud'}
          onClick={async () => {
            await logout();
            navigate(`/${locale}/auth/login`);
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-semibold text-primary">
              {(user?.email?.[0] ?? '?').toUpperCase()}
            </span>
          </div>
          <span className="hidden sm:block max-w-[120px] truncate">{user?.email}</span>
          <LogOut className="h-3.5 w-3.5 shrink-0 hidden sm:block" />
        </button>
      </div>
    </header>
  );
}
