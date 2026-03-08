import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { Plus, Trash2, CalendarDays, X } from 'lucide-react';

type Todo = {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'done';
  due_date?: string | null;
  assigned_to?: string | null;
  created_at?: string;
};

export default function TodosPage() {
  const { toast } = useToast();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [showDone, setShowDone] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.listTodos();
      setTodos(res.data as Todo[]);
    } catch {
      // silent — empty state shown
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setLoading(true);
    try {
      await api.createTodo({ title, dueDate: newDueDate || undefined });
      setNewTitle('');
      setNewDueDate('');
      await loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Kunne ikke oprette', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (todo: Todo) => {
    const next = todo.status === 'done' ? 'open' : 'done';
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, status: next } : t));
    try {
      await api.updateTodo(todo.id, { status: next });
    } catch {
      await loadData(); // revert on failure
    }
  };

  const handleDelete = async (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    try {
      await api.deleteTodo(id);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Kunne ikke slette', variant: 'destructive' });
      await loadData();
    }
  };

  const open = todos.filter(t => t.status !== 'done');
  const done = todos.filter(t => t.status === 'done');
  const today = new Date().toISOString().split('T')[0];

  const isOverdue = (due?: string | null) => due && due < today;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">To-dos</h1>
        <p className="text-sm text-muted-foreground">Dine personlige to-dos og påmindelser</p>
      </div>

      {/* New todo input */}
      <div className="flex gap-2">
        <Input
          placeholder="Ny to-do — skriv og tryk Enter"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
          className="flex-1"
        />
        <Input
          type="date"
          value={newDueDate}
          onChange={e => setNewDueDate(e.target.value)}
          className="w-36"
          title="Forfaldsdato (valgfrit)"
        />
        <Button onClick={handleCreate} disabled={loading || !newTitle.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Open todos */}
      {open.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/70 backdrop-blur p-10 flex flex-col items-center justify-center gap-2 text-center">
          <div className="text-3xl">✅</div>
          <p className="text-sm text-muted-foreground">Ingen åbne to-dos — godt klaret!</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/70 overflow-hidden">
          <div className="divide-y divide-border">
            {open.map(todo => (
              <div key={todo.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group">
                <Checkbox
                  checked={false}
                  onCheckedChange={() => handleToggle(todo)}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{todo.title}</p>
                  {todo.due_date && (
                    <p className={`text-xs flex items-center gap-1 mt-0.5 ${isOverdue(todo.due_date) ? 'text-red-500' : 'text-muted-foreground'}`}>
                      <CalendarDays className="h-3 w-3" />
                      {isOverdue(todo.due_date) ? 'Forfalden: ' : 'Forfalder: '}
                      {new Date(todo.due_date).toLocaleDateString('da-DK')}
                    </p>
                  )}
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
                  onClick={() => handleDelete(todo.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Done todos */}
      {done.length > 0 && (
        <div>
          <button
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
            onClick={() => setShowDone(s => !s)}
          >
            {showDone ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {done.length} afsluttede to-dos
          </button>
          {showDone && (
            <div className="rounded-2xl border border-border bg-card/50 overflow-hidden opacity-60">
              <div className="divide-y divide-border">
                {done.map(todo => (
                  <div key={todo.id} className="flex items-center gap-3 px-4 py-3 group">
                    <Checkbox
                      checked
                      onCheckedChange={() => handleToggle(todo)}
                      className="shrink-0"
                    />
                    <p className="text-sm line-through text-muted-foreground flex-1 truncate">{todo.title}</p>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
                      onClick={() => handleDelete(todo.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
