import { ListTodo } from 'lucide-react';

export default function TodosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">To-dos</h1>
        <p className="text-sm text-muted-foreground">Dine personlige to-dos og påmindelser</p>
      </div>
      <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-12 flex flex-col items-center justify-center gap-3 text-center">
        <ListTodo className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Ingen to-dos endnu</p>
      </div>
    </div>
  );
}
