import { Menu, Search } from 'lucide-react';
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
  const { logout } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-background/80 backdrop-blur px-4 lg:px-6 py-3.5">
      {/* Hamburger — mobile only */}
      <button
        className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors shrink-0"
        onClick={onMenuToggle}
        aria-label="Åbn menu"
      >
        <Menu className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Command palette trigger */}
      <button
        className="flex items-center gap-2 flex-1 max-w-sm rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
        onClick={openCommandPalette}
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 hidden sm:block">Søg eller hop til...</span>
        <kbd className="hidden sm:block text-xs border border-border rounded px-1.5 py-0.5 font-mono bg-background">⌘K</kbd>
      </button>

      <div className="flex items-center gap-2 lg:gap-3 shrink-0">
        <LanguagePicker />
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await logout();
            navigate(`/${locale}/auth/login`);
          }}
        >
          <span className="hidden sm:inline">{t('common.signOut')}</span>
          <span className="sm:hidden text-xs">Log ud</span>
        </Button>
      </div>
    </div>
  );
}
