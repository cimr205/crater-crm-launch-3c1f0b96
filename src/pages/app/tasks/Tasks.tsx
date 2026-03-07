import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { Bot, Check, X, Plus, RefreshCw, Trash2, Clock } from 'lucide-react';

type Task = {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending_approval' | 'approved' | 'in_progress' | 'done' | 'rejected';
  source: 'email' | 'meta' | 'crm' | 'manual' | 'ai';
  deadline: string | null;
  leadId: string | null;
  leadName: string | null;
  assignedToName: string | null;
  emailSubject: string | null;
  emailFrom: string | null;
  aiReason: string | null;
  createdAt: string;
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500/10 text-red-600 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  low: 'bg-muted text-muted-foreground',
};

const priorityLabel: Record<string, string> = {
  urgent: 'Akut',
  high: 'Høj',
  medium: 'Medium',
  low: 'Lav',
};

const sourceLabel: Record<string, string> = {
  email: 'E-mail',
  meta: 'Meta Ads',
  crm: 'CRM',
  manual: 'Manuel',
  ai: 'AI',
};

const statusLabel: Record<string, string> = {
  pending_approval: 'Afventer godkendelse',
  approved: 'Godkendt',
  in_progress: 'I gang',
  done: 'Færdig',
  rejected: 'Afvist',
};

function TaskCard({
  task,
  onApprove,
  onReject,
  onDelete,
  onMarkDone,
  loading,
}: {
  task: Task;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  onMarkDone: (id: string) => void;
  loading: boolean;
}) {
  const isPendingApproval = task.status === 'pending_approval';
  const isApproved = task.status === 'approved' || task.status === 'in_progress';
  const isDone = task.status === 'done';
  const isRejected = task.status === 'rejected';

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 transition-opacity ${
        isRejected || isDone ? 'opacity-50 border-border' : 'border-border'
      } ${isPendingApproval ? 'border-l-4 border-l-primary' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{task.title}</span>
            <Badge variant="outline" className={`text-xs ${priorityColors[task.priority]}`}>
              {priorityLabel[task.priority]}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {sourceLabel[task.source]}
            </Badge>
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isPendingApproval && (
            <>
              <Button size="sm" onClick={() => onApprove(task.id)} disabled={loading} className="h-7 px-2">
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onReject(task.id)} disabled={loading} className="h-7 px-2">
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {isApproved && (
            <Button size="sm" variant="outline" onClick={() => onMarkDone(task.id)} disabled={loading} className="h-7 text-xs">
              Færdig
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onDelete(task.id)} disabled={loading} className="h-7 px-2 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {task.deadline && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Deadline: {new Date(task.deadline).toLocaleDateString('da-DK')}
          </span>
        )}
        {task.leadName && <span>Lead: {task.leadName}</span>}
        {task.assignedToName && <span>Tildelt: {task.assignedToName}</span>}
        {task.emailFrom && <span>Fra: {task.emailFrom}</span>}
        {task.emailSubject && <span className="truncate max-w-xs">Mail: {task.emailSubject}</span>}
      </div>

      {task.aiReason && (
        <div className="flex items-start gap-2 rounded bg-muted/40 px-3 py-2">
          <Bot className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <span className="text-xs text-muted-foreground">{task.aiReason}</span>
        </div>
      )}

      {isPendingApproval && (
        <div className="text-xs text-primary font-medium flex items-center gap-1">
          <Bot className="h-3 w-3" />
          AI-forslag — klik ✓ for at godkende eller ✗ for at afvise
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newDeadline, setNewDeadline] = useState('');

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await api.listTasks(
        filterStatus !== 'all' ? { status: filterStatus } : undefined
      );
      setTasks(res.data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load tasks');
    }
  }, [filterStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (taskId: string) => {
    setLoading(true);
    try {
      await api.approveTask(taskId);
      toast({ title: 'Opgave godkendt' });
      await loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not approve', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (taskId: string) => {
    setLoading(true);
    try {
      await api.rejectTask(taskId);
      toast({ title: 'Opgave afvist' });
      await loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not reject', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    setLoading(true);
    try {
      await api.deleteTask(taskId);
      await loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not delete', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDone = async (taskId: string) => {
    setLoading(true);
    try {
      await api.updateTask(taskId, { status: 'done' });
      toast({ title: 'Opgave markeret som færdig' });
      await loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not update', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTitle.trim()) return;
    setLoading(true);
    try {
      await api.createTask({
        title: newTitle,
        description: newDescription,
        priority: newPriority,
        deadline: newDeadline || undefined,
      });
      toast({ title: 'Opgave oprettet' });
      setShowCreate(false);
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      setNewDeadline('');
      await loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not create task', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAiGenerate = async () => {
    setAiGenerating(true);
    try {
      const res = await api.generateAiTasks();
      toast({ title: `AI genererede ${res.created} nye opgave-forslag` });
      await loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'AI generation failed', variant: 'destructive' });
    } finally {
      setAiGenerating(false);
    }
  };

  const pendingApproval = tasks.filter((t) => t.status === 'pending_approval');
  const activeTasks = tasks.filter((t) => ['approved', 'in_progress'].includes(t.status));
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const rejectedTasks = tasks.filter((t) => t.status === 'rejected');

  const displayTasks =
    filterStatus === 'all'
      ? tasks
      : filterStatus === 'pending_approval'
      ? pendingApproval
      : filterStatus === 'active'
      ? activeTasks
      : filterStatus === 'done'
      ? doneTasks
      : tasks;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI Opgaver</h1>
          <p className="text-sm text-muted-foreground">
            AI-genererede opgaver fra e-mails, leads og pipeline — med godkendelsesflow
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAiGenerate} disabled={aiGenerating}>
            <Bot className="h-4 w-4 mr-1" />
            {aiGenerating ? 'AI analyserer...' : 'AI scan'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Opdater
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Manuel opgave
          </Button>
        </div>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => setFilterStatus('pending_approval')}
          className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
            filterStatus === 'pending_approval' ? 'bg-muted' : 'bg-card/60'
          }`}
        >
          <div className="text-lg font-semibold text-primary">{pendingApproval.length}</div>
          <div className="text-xs text-muted-foreground">Afventer godkendelse</div>
        </button>
        <button
          onClick={() => setFilterStatus('active')}
          className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
            filterStatus === 'active' ? 'bg-muted' : 'bg-card/60'
          }`}
        >
          <div className="text-lg font-semibold">{activeTasks.length}</div>
          <div className="text-xs text-muted-foreground">Aktive opgaver</div>
        </button>
        <button
          onClick={() => setFilterStatus('done')}
          className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
            filterStatus === 'done' ? 'bg-muted' : 'bg-card/60'
          }`}
        >
          <div className="text-lg font-semibold text-green-600">{doneTasks.length}</div>
          <div className="text-xs text-muted-foreground">Færdige</div>
        </button>
        <button
          onClick={() => setFilterStatus('all')}
          className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
            filterStatus === 'all' ? 'bg-muted' : 'bg-card/60'
          }`}
        >
          <div className="text-lg font-semibold">{tasks.length}</div>
          <div className="text-xs text-muted-foreground">Alle</div>
        </button>
      </div>

      {/* Create task form */}
      {showCreate && (
        <Card className="p-5 bg-card/70 border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Opret opgave</div>
            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <Input
            placeholder="Opgavetitel"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Textarea
            placeholder="Beskrivelse (valgfrit)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={3}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Prioritet</div>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as typeof newPriority)}
              >
                <option value="low">Lav</option>
                <option value="medium">Medium</option>
                <option value="high">Høj</option>
                <option value="urgent">Akut</option>
              </select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Deadline</div>
              <Input
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateTask} disabled={loading || !newTitle.trim()}>
              Opret opgave
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Annuller
            </Button>
          </div>
        </Card>
      )}

      {/* AI explanation */}
      {pendingApproval.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg bg-primary/5 border border-primary/20 p-4">
          <Bot className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium">
              {pendingApproval.length} AI-forslag afventer din godkendelse
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              AI'en har analyseret dine e-mails og systemdata og foreslår disse opgaver. Gennemgå
              hvert forslag og godkend eller afvis. Du kan altid redigere en opgave efter godkendelse.
            </p>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-3">
        {displayTasks.length === 0 ? (
          <Card className="p-8 bg-card/70 border-border text-center">
            <div className="text-muted-foreground text-sm space-y-2">
              <div className="text-3xl">✅</div>
              <div>Ingen opgaver at vise.</div>
              <div className="text-xs">
                Klik "AI scan" for at lade AI'en analysere dine e-mails og foreslå opgaver.
              </div>
            </div>
          </Card>
        ) : (
          displayTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onApprove={handleApprove}
              onReject={handleReject}
              onDelete={handleDelete}
              onMarkDone={handleMarkDone}
              loading={loading}
            />
          ))
        )}
      </div>

      {/* How it works */}
      <Card className="p-5 bg-card/70 border-border">
        <div className="text-sm font-semibold mb-2">Sådan fungerer AI-opgaver</div>
        <div className="grid md:grid-cols-2 gap-4 text-xs text-muted-foreground">
          <ul className="space-y-1">
            <li>→ AI'en scanner dine e-mails og finder handlinger der skal tages</li>
            <li>→ Den sætter automatisk titel, beskrivelse, prioritet og deadline</li>
            <li>→ Opgaver kobles til leads i CRM hvis muligt</li>
            <li>→ Alle AI-forslag kræver din godkendelse før de aktiveres</li>
          </ul>
          <ul className="space-y-1">
            <li>→ AI'en kigger også på Meta Ads performance og pipeline</li>
            <li>→ Den foreslår opfølgning, demobooking og tilbudsopgaver</li>
            <li>→ Deadlines sættes ud fra hvad der nævnes i mails (i morgen, tirsdag osv.)</li>
            <li>→ Prioritet sættes ud fra urgency i sproget i mailen</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
