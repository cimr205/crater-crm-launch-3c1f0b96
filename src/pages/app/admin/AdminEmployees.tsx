import { UserSquare2 } from 'lucide-react';

export default function AdminEmployeesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Medarbejdere</h1>
        <p className="text-sm text-muted-foreground">Overblik over alle medarbejdere på tværs af virksomheder</p>
      </div>
      <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-12 flex flex-col items-center justify-center gap-3 text-center">
        <UserSquare2 className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Ingen medarbejdere fundet</p>
      </div>
    </div>
  );
}
