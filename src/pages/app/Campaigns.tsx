import { Megaphone } from 'lucide-react';

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Kampagner</h1>
        <p className="text-sm text-muted-foreground">Opret og administrer marketingkampagner</p>
      </div>
      <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-12 flex flex-col items-center justify-center gap-3 text-center">
        <Megaphone className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Ingen kampagner endnu</p>
      </div>
    </div>
  );
}
