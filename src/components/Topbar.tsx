import { Search } from 'lucide-react';
import { useI18n, isLocale } from '@/lib/i18n';
import LanguagePicker from '@/components/LanguagePicker';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import { openCommandPalette } from '@/components/CommandPalette';

export default function Topbar() {
  const { t } = useI18n();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border bg-background/80 backdrop-blur px-6 py-3.5">
      {/* Command palette trigger */}
      <button
        className="flex items-center gap-2 w-full max-w-sm rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
        onClick={openCommandPalette}
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">Søg eller hop til...</span>
        <kbd className="text-xs border border-border rounded px-1.5 py-0.5 font-mono bg-background">⌘K</kbd>
      </button>

      <div className="flex items-center gap-3 shrink-0">
        <LanguagePicker />
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await logout();
            navigate(`/${locale}/auth/login`);
          }}
        >
          {t('common.signOut')}
        </Button>
      </div>
    </div>
  );
}

