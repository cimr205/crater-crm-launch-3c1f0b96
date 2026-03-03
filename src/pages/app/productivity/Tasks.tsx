import { CheckSquare } from 'lucide-react';

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Opgaver</h1>
        <p className="text-sm text-muted-foreground">Hold styr på teamets opgaver og deadlines</p>
      </div>
      <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-12 flex flex-col items-center justify-center gap-3 text-center">
        <CheckSquare className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Ingen opgaver endnu</p>
      </div>
    </div>
  );
}
