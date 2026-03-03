import { CreditCard } from 'lucide-react';

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Betalinger</h1>
        <p className="text-sm text-muted-foreground">Overblik over ind- og udgående betalinger</p>
      </div>
      <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-12 flex flex-col items-center justify-center gap-3 text-center">
        <CreditCard className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Ingen betalinger endnu</p>
      </div>
    </div>
  );
}
