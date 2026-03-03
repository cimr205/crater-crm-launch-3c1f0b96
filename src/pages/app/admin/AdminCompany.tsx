import { Building2 } from 'lucide-react';

export default function AdminCompanyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Virksomheder</h1>
        <p className="text-sm text-muted-foreground">Se og administrer alle virksomheder i systemet</p>
      </div>
      <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-12 flex flex-col items-center justify-center gap-3 text-center">
        <Building2 className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Ingen virksomheder fundet</p>
      </div>
    </div>
  );
}
