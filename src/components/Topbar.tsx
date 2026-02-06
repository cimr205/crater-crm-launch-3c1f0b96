import { Bell, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import LanguagePicker from '@/components/LanguagePicker';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import { isLocale } from '@/lib/i18n';

export default function Topbar() {
  const { t } = useI18n();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border bg-background/80 backdrop-blur px-6 py-4">
      <div className="flex items-center gap-2 w-full max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder={t('common.search')} className="bg-card/60" />
      </div>
      <div className="flex items-center gap-3">
        <LanguagePicker />
        <button className="relative rounded-full border border-border bg-card/60 p-2">
          <Bell className="h-4 w-4" />
        </button>
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

