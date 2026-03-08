import { useState } from 'react';
import { ReactNode } from 'react';
import TenantSidebar from '@/components/TenantSidebar';
import Topbar from '@/components/Topbar';
import AiAgentWidget from '@/components/AiAgentWidget';
import CommandPalette from '@/components/CommandPalette';
import { useNotificationPoller } from '@/hooks/useNotificationPoller';

export default function AppShell({ basePath, children }: { basePath: string; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  useNotificationPoller();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <div className="flex">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <TenantSidebar
          basePath={basePath}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        <div className="flex-1 min-w-0">
          <Topbar onMenuToggle={() => setMobileOpen((v) => !v)} />
          <main className="p-4 lg:p-10">{children}</main>
        </div>
      </div>
      <AiAgentWidget />
      <CommandPalette />
    </div>
  );
}
