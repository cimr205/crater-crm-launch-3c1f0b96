import { Settings } from 'lucide-react';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">System indstillinger</h1>
        <p className="text-sm text-muted-foreground">Globale indstillinger for hele platformen</p>
      </div>
      <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-12 flex flex-col items-center justify-center gap-3 text-center">
        <Settings className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Ingen indstillinger tilgængelige endnu</p>
      </div>
    </div>
  );
}
