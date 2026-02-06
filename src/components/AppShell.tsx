import { ReactNode } from 'react';
import TenantSidebar from '@/components/TenantSidebar';
import Topbar from '@/components/Topbar';

export default function AppShell({ basePath, children }: { basePath: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <div className="flex">
        <TenantSidebar basePath={basePath} />
        <div className="flex-1">
          <Topbar />
          <main className="p-6 lg:p-10">{children}</main>
        </div>
      </div>
    </div>
  );
}




