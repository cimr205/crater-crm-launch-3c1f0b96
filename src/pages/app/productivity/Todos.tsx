import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { isConfigured } from '@/lib/serviceConfig';
import * as dt from '@/lib/donetick';
import { CheckSquare, Square, Trash2, Plus, ChevronDown, ChevronUp, Settings } from 'lucide-react';

// ─── Unified todo shape ───────────────────────────────────────────────────────

interface Todo {
  id: string;           // string for compatibility with both backends
  title: string;
  done: boolean;
  dueDate: string | null;
  source: 'donetick' | 'backend';
}

// ─── Backend mapping ──────────────────────────────────────────────────────────

interface BackendTodo { id: string; title: string; completed: boolean; due_date?: string | null; }

function fromBackend(t: BackendTodo): Todo {
  return { id: t.id, title: t.title, done: t.completed, dueDate: t.due_date ?? null, source: 'backend' };
}

function fromDonetick(c: dt.DonetickChore): Todo {
  return {
    id: String(c.id),
    title: c.name,
    done: !c.isActive || Boolean(c.completedAt),
    dueDate: c.nextDueDate ?? null,
    source: 'donetick',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOverdue(todo: Todo): boolean {
  if (!todo.dueDate || todo.done) return false;
  return new Date(todo.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
}

function formatDue(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  if (d < today) return `Overskredet ${d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}`;
  if (d.getTime() === today.getTime()) return 'I dag';
  if (d.getTime() === tomorrow.getTime()) return 'I morgen';
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TodosPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const useDonetick = isConfigured('donetick');

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState('');
  const [showDone, setShowDone] = useState(false);

  const loadTodos = useCallback(async () => {
    setLoading(true);
    try {
      if (useDonetick) {
        const chores = await dt.listChores();
        setTodos(chores.map(fromDonetick));
      } else {
        const res = await api.listTodos().catch(() => ({ data: [] }));
        setTodos(((res as { data: BackendTodo[] }).data ?? []).map(fromBackend));
      }
    } catch {
      // Silent — show empty list
    } finally {
      setLoading(false);
    }
  }, [useDonetick]);

  useEffect(() => { void loadTodos(); }, [loadTodos]);

  // ── Create ────────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;

    const optimistic: Todo = {
      id: `opt-${Date.now()}`,
      title,
      done: false,
      dueDate: newDue || null,
      source: useDonetick ? 'donetick' : 'backend',
    };
    setTodos((prev) => [optimistic, ...prev]);
    setNewTitle('');
    setNewDue('');

    try {
      if (useDonetick) {
        const chore = await dt.createChore(title, '', newDue || undefined);
        setTodos((prev) => prev.map((t) => t.id === optimistic.id ? fromDonetick(chore) : t));
      } else {
        const res = await api.createTodo({ title, due_date: newDue || undefined });
        const created = (res as { data: BackendTodo }).data;
        setTodos((prev) => prev.map((t) => t.id === optimistic.id ? fromBackend(created) : t));
      }
    } catch (err) {
      setTodos((prev) => prev.filter((t) => t.id !== optimistic.id));
      toast({ title: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleCreate();
  };

  // ── Toggle done ───────────────────────────────────────────────────────────────

  const handleToggle = async (todo: Todo) => {
    const newDone = !todo.done;
    setTodos((prev) => prev.map((t) => t.id === todo.id ? { ...t, done: newDone } : t));

    try {
      if (useDonetick) {
        if (newDone) await dt.completeChore(Number(todo.id));
        else await dt.updateChore(Number(todo.id), { isActive: true });
      } else {
        await api.updateTodo(todo.id, { completed: newDone });
      }
    } catch (err) {
      setTodos((prev) => prev.map((t) => t.id === todo.id ? { ...t, done: !newDone } : t));
      toast({ title: (err as Error).message, variant: 'destructive' });
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = async (todo: Todo) => {
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    try {
      if (useDonetick) await dt.deleteChore(Number(todo.id));
      else await api.deleteTodo(todo.id);
    } catch (err) {
      toast({ title: (err as Error).message, variant: 'destructive' });
      void loadTodos();
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">To-dos</h1>
          <p className="text-sm text-muted-foreground">
            {useDonetick ? 'Donetick — self-hosted task tracker' : 'Personlige opgaver og huskeliste'}
          </p>
        </div>
        {useDonetick && (
          <Button size="sm" variant="outline" onClick={() => navigate('/app/integrations')}>
            <Settings className="h-3.5 w-3.5 mr-1" />Donetick
          </Button>
        )}
      </div>

      {/* Create */}
      <div className="flex gap-2">
        <Input
          placeholder="Ny to-do — tryk Enter for at tilføje"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Input
          type="date"
          value={newDue}
          onChange={(e) => setNewDue(e.target.value)}
          className="w-36"
          placeholder="Forfaldsdato"
        />
        <Button onClick={() => void handleCreate()} disabled={!newTitle.trim()}>
          <Plus className="h-4 w-4 mr-1" />Tilføj
        </Button>
      </div>

      {/* Open todos */}
      <div className="space-y-1">
        {loading && open.length === 0 && (
          <div className="text-sm text-muted-foreground py-6 text-center">Henter to-dos...</div>
        )}
        {!loading && open.length === 0 && (
          <div className="rounded-2xl border border-border bg-card/70 p-12 flex flex-col items-center gap-3 text-center">
            <CheckSquare className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Ingen åbne to-dos</p>
            {useDonetick === false && (
              <p className="text-xs text-muted-foreground">Tip: Konfigurér <button className="underline" onClick={() => navigate('/app/integrations')}>Donetick</button> som self-hosted backend</p>
            )}
          </div>
        )}
        {open.map((todo) => {
          const overdue = isOverdue(todo);
          return (
            <div key={todo.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 bg-card/60 hover:bg-card/80 transition-colors group">
              <button onClick={() => void handleToggle(todo)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                <Square className="h-4 w-4" />
              </button>
              <span className="flex-1 text-sm">{todo.title}</span>
              {todo.dueDate && (
                <span className={`text-xs shrink-0 ${overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                  {formatDue(todo.dueDate)}
                </span>
              )}
              <button onClick={() => void handleDelete(todo)} className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Done todos (collapsible) */}
      {done.length > 0 && (
        <div className="space-y-1">
          <button
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            onClick={() => setShowDone((v) => !v)}
          >
            {showDone ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Færdige ({done.length})
          </button>
          {showDone && done.map((todo) => (
            <div key={todo.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 bg-card/30 opacity-60 group">
              <button onClick={() => void handleToggle(todo)} className="shrink-0 text-green-500 hover:text-muted-foreground transition-colors">
                <CheckSquare className="h-4 w-4" />
              </button>
              <span className="flex-1 text-sm line-through text-muted-foreground">{todo.title}</span>
              <button onClick={() => void handleDelete(todo)} className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
