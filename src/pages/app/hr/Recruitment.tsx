import { UserPlus } from 'lucide-react';

export default function RecruitmentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rekruttering</h1>
        <p className="text-sm text-muted-foreground">Administrer jobopslag og kandidater</p>
      </div>
      <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-12 flex flex-col items-center justify-center gap-3 text-center">
        <UserPlus className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Ingen rekrutteringssager endnu</p>
      </div>
    </div>
  );
}
