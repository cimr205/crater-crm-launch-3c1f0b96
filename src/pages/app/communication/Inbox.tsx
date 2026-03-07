import { Inbox } from 'lucide-react';

export default function InboxPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Indbakke</h1>
        <p className="text-sm text-muted-foreground">Alle beskeder og notifikationer samlet</p>
      </div>
      <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-12 flex flex-col items-center justify-center gap-3 text-center">
        <Inbox className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Indbakken er tom</p>
      </div>
    </div>
  );
}
