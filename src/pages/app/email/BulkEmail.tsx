import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Mail, Upload, Users, Send, Pause, Play, XCircle, CheckCircle2,
  Loader2, RefreshCw, Eye, ChevronRight, ChevronLeft, AlertTriangle,
  BarChart2, Clock, Zap, FileText, Trash2, Paperclip,
} from 'lucide-react';

// ── Attachment type ────────────────────────────────────────────────────────────

type Attachment = {
  filename: string;
  content_type: string;
  data: string; // base64
  size: number;
};

// ── CSV parser (ingen deps) ───────────────────────────────────────────────────

function parseCsv(text: string): { headers: string[]; rows: Array<Record<string, string>> } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const vals = parseRow(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });

      // Auto-derive initials + first/last name fra standard kolonner
      const email = row['email'] ?? row['Email'] ?? row['EMAIL'] ?? '';
      const fullName =
        row['name'] ?? row['Name'] ?? row['full_name'] ?? row['Full Name'] ??
        row['fornavn'] ?? row['Fornavn'] ?? '';
      const firstName =
        row['first_name'] ?? row['First Name'] ?? row['firstname'] ??
        row['fornavn'] ?? row['Fornavn'] ?? fullName.split(' ')[0] ?? '';
      const lastName =
        row['last_name'] ?? row['Last Name'] ?? row['lastname'] ??
        row['efternavn'] ?? row['Efternavn'] ?? fullName.split(' ').slice(1).join(' ') ?? '';
      const company =
        row['company'] ?? row['Company'] ?? row['virksomhed'] ?? row['Virksomhed'] ?? '';

      // Normalized aliases (bruges i skabelon som {{first_name}} osv.)
      row['_email'] = email;
      row['_first_name'] = firstName;
      row['_last_name'] = lastName;
      row['_full_name'] = fullName || `${firstName} ${lastName}`.trim();
      row['_company'] = company;
      row['_initials'] = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase();
      return row;
    });

  return { headers, rows };
}

// ── Template renderer ─────────────────────────────────────────────────────────

function renderTemplate(template: string, row: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    // Prøv direkte nøgle, derefter normaliseret alias
    return row[key] ?? row[`_${key}`] ?? `{{${key}}}`;
  });
}

// ── Job types ─────────────────────────────────────────────────────────────────

type JobStatus = 'pending' | 'sending' | 'paused' | 'completed' | 'failed';

type BulkJob = {
  job_id: string;
  job_name: string;
  status: JobStatus;
  total: number;
  sent: number;
  failed: number;
  opens: number;
  clicks: number;
  created_at: string;
  completed_at?: string;
};

const STATUS_META: Record<JobStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: 'Venter',    color: 'text-yellow-600 bg-yellow-500/10', icon: Clock },
  sending:   { label: 'Sender…',   color: 'text-blue-600 bg-blue-500/10',    icon: Loader2 },
  paused:    { label: 'Pause',     color: 'text-orange-600 bg-orange-500/10', icon: Pause },
  completed: { label: 'Færdig',    color: 'text-green-600 bg-green-500/10',  icon: CheckCircle2 },
  failed:    { label: 'Fejlet',    color: 'text-red-600 bg-red-500/10',      icon: XCircle },
};

// ── Default templates ─────────────────────────────────────────────────────────

const SUBJECT_TEMPLATES = [
  'Hej {{first_name}}, har du 2 min?',
  '{{first_name}} — vi hjælper {{company}} med X',
  'Til {{first_name}} hos {{company}}',
  '{{initials}}. — Kort spørgsmål om jeres vækst',
  'Hej {{first_name}}, vi ringede ikke',
];

const BODY_TEMPLATES = [
  {
    label: 'Outreach A (direkte)',
    subject: 'Hej {{first_name}}, har du 2 min?',
    body: `Hej {{first_name}},

Jeg nåede ud til dig, fordi vi hjælper virksomheder som {{company}} med at spare tid på leads og administration.

Vi har hjulpet +50 virksomheder med at samle CRM, HR og drift ét sted — og de fleste ser resultater inden for 30 dage.

Har du 15 min til en hurtig snak denne uge?

Bedste hilsner`,
  },
  {
    label: 'Outreach B (problem-first)',
    subject: '{{first_name}} — bruger I stadig 3 systemer?',
    body: `Hej {{first_name}},

Mange virksomheder som {{company}} kæmper med:
- Leads der falder mellem to stole
- HR og CRM der ikke taler sammen
- For meget tid på administration

Vi har bygget en platform der løser det — og den tager under en uge at implementere.

Må jeg sende dig en kort demo-video?

Bedste`,
  },
  {
    label: 'Follow-up (ikke svaret)',
    subject: 'Hej {{first_name}} — bare tjekker ind',
    body: `Hej {{first_name}},

Jeg sendte dig en besked for et par dage siden og ville ikke gå glip af muligheden for at tale med dig.

Er der et bedre tidspunkt for mig at kontakte dig?

Bedste hilsner`,
  },
  {
    label: 'Retargeting (besøgte siden)',
    subject: '{{first_name}} — du kiggede på os, men bookede ikke',
    body: `Hej {{first_name}},

Jeg lagde mærke til at du besøgte vores side — tak for interessen!

Mange spørger os om det samme: "Passer det til vores størrelse?" — svaret er ja.

Vi hjælper virksomheder fra 3 til 200+ medarbejdere.

Vil du have en gratis demo på 15 minutter?

Bedste`,
  },
];

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatMini({ label, value, color = '' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

// ── Job row ───────────────────────────────────────────────────────────────────

function JobRow({
  job, onPause, onResume, onCancel, busy,
}: {
  job: BulkJob;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  busy: boolean;
}) {
  const meta = STATUS_META[job.status];
  const pct = job.total > 0 ? Math.round((job.sent / job.total) * 100) : 0;
  const openRate = job.sent > 0 ? ((job.opens / job.sent) * 100).toFixed(1) : '—';
  const clickRate = job.sent > 0 ? ((job.clicks / job.sent) * 100).toFixed(1) : '—';

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{job.job_name}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
              <meta.icon className={`h-3 w-3 ${job.status === 'sending' ? 'animate-spin' : ''}`} />
              {meta.label}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span>{job.sent} / {job.total} sendt</span>
            <span>Åbnet: {openRate}%</span>
            <span>Klik: {clickRate}%</span>
            {job.failed > 0 && <span className="text-red-500">{job.failed} fejl</span>}
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden w-full max-w-sm">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                job.status === 'completed' ? 'bg-green-500' :
                job.status === 'failed' ? 'bg-red-500' : 'bg-primary'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {job.status === 'sending' && (
            <button
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
              onClick={() => onPause(job.job_id)}
              disabled={busy}
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
          )}
          {job.status === 'paused' && (
            <button
              className="text-xs px-2.5 py-1.5 rounded-lg border border-green-500/30 text-green-600 hover:bg-green-500/10 transition-colors"
              onClick={() => onResume(job.job_id)}
              disabled={busy}
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          {(job.status === 'pending' || job.status === 'paused') && (
            <button
              className="text-xs px-2.5 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => onCancel(job.job_id)}
              disabled={busy}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── View types ────────────────────────────────────────────────────────────────

type View = 'composer' | 'preview' | 'history';

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BulkEmailPage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  // CSV state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Array<Record<string, string>>>([]);
  const [csvFileName, setCsvFileName] = useState('');

  // Attachment state
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Composer state
  const [jobName, setJobName] = useState('');
  const [subject, setSubject] = useState('Hej {{first_name}}, har du 2 min?');
  const [body, setBody] = useState(BODY_TEMPLATES[0].body);
  const [replyTo, setReplyTo] = useState('');
  const [fromName, setFromName] = useState('');
  const [dailyLimit, setDailyLimit] = useState(700);
  const [intervalSec, setIntervalSec] = useState(120);
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);

  // UI state
  const [view, setView] = useState<View>('composer');
  const [previewIdx, setPreviewIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState<BulkJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [busy, setBusy] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await api.listBulkEmailJobs();
      setJobs(res.data as BulkJob[]);
    } catch { /* ignore */ }
    finally { setLoadingJobs(false); }
  }, []);

  useEffect(() => { void loadJobs(); }, [loadJobs]);

  // Auto-poll hvis der er aktive jobs
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'sending' || j.status === 'pending');
    if (hasActive && !pollingRef.current) {
      pollingRef.current = setInterval(() => void loadJobs(), 5000);
    } else if (!hasActive && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [jobs, loadJobs]);

  // CSV load
  const handleCsvFile = (file: File) => {
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCsv(text);
      setCsvHeaders(headers);
      setCsvRows(rows);
      toast({ title: `${rows.length} modtagere indlæst fra ${file.name}` });
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) handleCsvFile(file);
  };

  // Attachment handler
  const handleAttachFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: `${file.name} er for stor (maks 10 MB)`, variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        // Strip "data:...;base64," prefix
        const base64 = dataUrl.split(',')[1] ?? '';
        setAttachments((prev) => [
          ...prev.filter((a) => a.filename !== file.name),
          { filename: file.name, content_type: file.type || 'application/octet-stream', data: base64, size: file.size },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (filename: string) =>
    setAttachments((prev) => prev.filter((a) => a.filename !== filename));

  // Load skabelon
  const loadTemplate = (tpl: typeof BODY_TEMPLATES[0]) => {
    setSubject(tpl.subject);
    setBody(tpl.body);
  };

  // Preview rendered
  const previewRow = csvRows[previewIdx];
  const previewSubject = previewRow ? renderTemplate(subject, previewRow) : subject;
  const previewBody = previewRow ? renderTemplate(body, previewRow) : body;

  // Validering
  const canSend = csvRows.length > 0 && subject.trim() && body.trim() && jobName.trim();

  const handleSend = async () => {
    if (!canSend) return;
    setSubmitting(true);
    try {
      const res = await api.submitBulkEmailJob({
        jobName,
        subjectTemplate: subject,
        bodyTemplate: body,
        replyTo: replyTo || undefined,
        fromName: fromName || undefined,
        recipients: csvRows,
        dailyLimit,
        sendIntervalSeconds: intervalSec,
        trackOpens,
        trackClicks,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      toast({
        title: `${res.queued} emails sat i kø`,
        description: `Estimeret: ~${res.estimated_minutes} min. Dag-limit: ${dailyLimit}/dag`,
      });
      setView('history');
      await loadJobs();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Afsendelse fejlede', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const jobAction = async (id: string, action: 'pause' | 'resume' | 'cancel') => {
    setBusy(true);
    try {
      if (action === 'pause') await api.pauseBulkEmailJob(id);
      else if (action === 'resume') await api.resumeBulkEmailJob(id);
      else await api.cancelBulkEmailJob(id);
      await loadJobs();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Handling fejlede', variant: 'destructive' });
    } finally {
      setBusy(false); }
  };

  const totalStats = {
    total: jobs.reduce((s, j) => s + j.total, 0),
    sent: jobs.reduce((s, j) => s + j.sent, 0),
    opens: jobs.reduce((s, j) => s + j.opens, 0),
    clicks: jobs.reduce((s, j) => s + j.clicks, 0),
  };

  const variableHint = ['{{first_name}}', '{{last_name}}', '{{initials}}', '{{company}}', '{{email}}', ...csvHeaders.filter((h) => !h.startsWith('_')).slice(0, 4)];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            Bulk Email
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personlig outreach i skala — op til {dailyLimit.toLocaleString()} emails om dagen fra CSV
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadJobs()} disabled={loadingJobs}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingJobs ? 'animate-spin' : ''}`} />
            Opdater
          </Button>
        </div>
      </div>

      {/* Platform stats */}
      {jobs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatMini label="Emails i alt" value={totalStats.total.toLocaleString()} />
          <StatMini label="Sendt" value={totalStats.sent.toLocaleString()} color="text-green-600" />
          <StatMini label="Åbnet" value={totalStats.sent > 0 ? `${((totalStats.opens / totalStats.sent) * 100).toFixed(1)}%` : '—'} color="text-blue-600" />
          <StatMini label="Klik" value={totalStats.sent > 0 ? `${((totalStats.clicks / totalStats.sent) * 100).toFixed(1)}%` : '—'} color="text-purple-600" />
        </div>
      )}

      {/* Tab nav */}
      <div className="flex border-b border-border">
        {([
          { id: 'composer' as View, label: 'Ny udsendelse', icon: Send },
          { id: 'preview'  as View, label: `Preview${csvRows.length > 0 ? ` (${csvRows.length})` : ''}`, icon: Eye },
          { id: 'history'  as View, label: `Historik${jobs.length > 0 ? ` (${jobs.length})` : ''}`, icon: BarChart2 },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              view === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── COMPOSER ── */}
      {view === 'composer' && (
        <div className="space-y-5">
          {/* CSV upload */}
          <div
            className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
              csvRows.length > 0 ? 'border-green-500/50 bg-green-500/5' : 'border-border hover:border-primary/50 hover:bg-muted/20'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); e.target.value = ''; }}
            />
            {csvRows.length > 0 ? (
              <div className="space-y-2">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                  {csvFileName} — {csvRows.length} modtagere
                </p>
                <p className="text-xs text-muted-foreground">
                  Kolonner: {csvHeaders.join(', ')}
                </p>
                <button
                  className="text-xs underline text-muted-foreground"
                  onClick={(e) => { e.stopPropagation(); setCsvRows([]); setCsvHeaders([]); setCsvFileName(''); }}
                >
                  Skift CSV
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-semibold">Træk CSV-fil hertil eller klik for at uploade</p>
                <p className="text-xs text-muted-foreground">
                  CSV skal indeholde kolonner som <code>email</code>, <code>first_name</code>, <code>company</code> osv.
                </p>
              </div>
            )}
          </div>

          {/* Job navn */}
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <p className="text-sm font-semibold">Kampagnenavn</p>
            <Input
              placeholder="Fx: Outreach januar 2026 — tandlæger"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
            />
          </div>

          {/* Skabeloner */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Email-skabelon
              </p>
              <div className="flex flex-wrap gap-1.5">
                {BODY_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    onClick={() => loadTemplate(tpl)}
                    className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-muted transition-colors"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Variable hint */}
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-muted-foreground font-medium">Variabler:</span>
              {variableHint.map((v) => (
                <code
                  key={v}
                  className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5 cursor-pointer hover:bg-primary/20"
                  onClick={() => setBody((b) => b + v)}
                  title="Klik for at tilføje til body"
                >
                  {v}
                </code>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">Emne *</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Hej {{first_name}}, har du 2 min?"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
                <Select onValueChange={(v) => setSubject(v)}>
                  <SelectTrigger className="w-10 px-2 shrink-0"><span className="sr-only">Forslag</span>⌄</SelectTrigger>
                  <SelectContent>
                    {SUBJECT_TEMPLATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">Besked *</label>
              <Textarea
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="font-mono text-xs"
                placeholder="Hej {{first_name}},&#10;&#10;Skriv din personlige besked her..."
              />
              <p className="text-xs text-muted-foreground">
                Brug <code>{'{{first_name}}'}</code>, <code>{'{{initials}}'}</code>, <code>{'{{company}}'}</code> og alle dine CSV-kolonner som variabler.
                Fx: <em>{'Hej {{first_name}}, vi hjælper virksomheder som {{company}}…'}</em>
              </p>
            </div>
          </div>

          {/* Afsender + indstillinger */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Afsender & throttle-indstillinger
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Fra-navn</label>
                <Input placeholder="Dit navn / virksomhedsnavn" value={fromName} onChange={(e) => setFromName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Svar-til email</label>
                <Input placeholder="svar@dinvirksomhed.dk" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} type="email" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  Dag-limit (maks/dag)
                </label>
                <Select value={String(dailyLimit)} onValueChange={(v) => setDailyLimit(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[100, 200, 300, 500, 700, 1000, 2000, 5000, 10000, 25000, 50000].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n.toLocaleString()} emails/dag</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Interval mellem emails
                </label>
                <Select value={String(intervalSec)} onValueChange={(v) => setIntervalSec(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 sekunder (hurtigst)</SelectItem>
                    <SelectItem value="60">1 minut</SelectItem>
                    <SelectItem value="120">2 minutter (anbefalet)</SelectItem>
                    <SelectItem value="300">5 minutter (forsigtigt)</SelectItem>
                    <SelectItem value="600">10 minutter (sikkert)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tracking toggles */}
            <div className="flex gap-6 pt-1">
              {([
                { label: 'Spor åbninger', value: trackOpens, set: setTrackOpens },
                { label: 'Spor klik', value: trackClicks, set: setTrackClicks },
              ] as const).map(({ label, value, set }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer">
                  <button
                    onClick={() => set((v) => !v)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </label>
              ))}
            </div>

            {/* Throttle info */}
            {csvRows.length > 0 && (
              <div className="rounded-xl bg-muted/40 border border-border p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Estimeret udsendelsestid</p>
                <p>
                  {csvRows.length} modtagere · {dailyLimit}/dag limit ·{' '}
                  {csvRows.length <= dailyLimit
                    ? 'Alt sendes i dag (én runde)'
                    : `~${Math.ceil(csvRows.length / dailyLimit)} dage`}
                </p>
                <p>
                  Interval: {intervalSec}s → ca. {Math.round(3600 / intervalSec)} emails/time
                  · {Math.min(dailyLimit, Math.round((3600 / intervalSec) * 12)).toLocaleString()} emails pr. 12-timer blok
                </p>
              </div>
            )}
          </div>

          {/* Fil-vedhæftninger */}
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary" />
                Vedhæftede filer
                {attachments.length > 0 && (
                  <Badge variant="secondary">{attachments.length}</Badge>
                )}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => attachRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Tilføj fil
              </Button>
              <input
                ref={attachRef}
                type="file"
                multiple
                className="sr-only"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt,.csv"
                onChange={(e) => { handleAttachFiles(e.target.files); e.target.value = ''; }}
              />
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Ingen vedhæftninger endnu — tilføj PDF, billeder, Word-filer osv. (maks 10 MB pr. fil).
                Filen sendes med til <em>alle</em> modtagere.
              </p>
            ) : (
              <div className="space-y-2">
                {attachments.map((att) => (
                  <div key={att.filename} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{att.filename}</p>
                        <p className="text-xs text-muted-foreground">{(att.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeAttachment(att.filename)}
                      className="ml-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Advarsel hvis ingen CSV */}
          {!csvRows.length && (
            <div className="flex items-center gap-2 rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Upload en CSV-fil med modtagere for at fortsætte
            </div>
          )}

          {/* Action row */}
          <div className="flex gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={() => { if (csvRows.length > 0) setView('preview'); }}
              disabled={csvRows.length === 0}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview {csvRows.length > 0 ? `(${csvRows.length} modtagere)` : ''}
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={() => void handleSend()}
              disabled={!canSend || submitting}
            >
              {submitting
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sender til kø…</>
                : <><Send className="h-4 w-4 mr-2" />Send {csvRows.length > 0 ? `${csvRows.length} emails` : ''}</>}
            </Button>
          </div>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {view === 'preview' && (
        <div className="space-y-4">
          {csvRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Upload en CSV-fil i "Ny udsendelse" for at se preview
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  Modtager {previewIdx + 1} af {csvRows.length}
                </p>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border border-border px-2.5 py-1.5 hover:bg-muted transition-colors disabled:opacity-40"
                    onClick={() => setPreviewIdx((i) => Math.max(0, i - 1))}
                    disabled={previewIdx === 0}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded-lg border border-border px-2.5 py-1.5 hover:bg-muted transition-colors disabled:opacity-40"
                    onClick={() => setPreviewIdx((i) => Math.min(csvRows.length - 1, i + 1))}
                    disabled={previewIdx === csvRows.length - 1}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Email preview card */}
              <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                {/* Email header */}
                <div className="border-b px-5 py-4 space-y-2 bg-muted/20">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0 shadow-sm">
                      {previewRow?.['_initials'] || '?'}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-xs text-muted-foreground">Til:</p>
                      <p className="text-sm font-semibold">
                        {previewRow?.['_full_name'] || previewRow?.['_first_name'] || '—'}
                        {previewRow?.['_email'] && <span className="text-muted-foreground ml-2 font-normal text-xs">&lt;{previewRow['_email']}&gt;</span>}
                      </p>
                      {previewRow?.['_company'] && (
                        <p className="text-xs text-muted-foreground">{previewRow['_company']}</p>
                      )}
                      {previewRow?.['_initials'] && (
                        <p className="text-xs text-primary font-medium">Initialer: {previewRow['_initials']}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Emne:</p>
                    <p className="text-sm font-semibold mt-0.5">{previewSubject}</p>
                  </div>
                </div>

                {/* Body */}
                <div className="px-5 py-5">
                  <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans">{previewBody}</pre>
                </div>

                {/* Attachments in preview */}
                {attachments.length > 0 && (
                  <div className="border-t px-5 py-3 space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                      <Paperclip className="h-3 w-3" />
                      Vedhæftede filer ({attachments.length})
                    </p>
                    {attachments.map((att) => (
                      <div key={att.filename} className="flex items-center gap-2 text-xs text-foreground">
                        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-medium">{att.filename}</span>
                        <span className="text-muted-foreground">({(att.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Raw data */}
              <details className="rounded-xl border border-border text-xs">
                <summary className="px-4 py-2.5 cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                  Vis rå CSV-data for denne modtager
                </summary>
                <div className="px-4 pb-3 pt-1 space-y-1 divide-y divide-border">
                  {Object.entries(previewRow ?? {}).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
                    <div key={k} className="flex gap-3 py-1">
                      <span className="text-muted-foreground w-32 shrink-0">{k}</span>
                      <span className="font-medium">{v || '—'}</span>
                    </div>
                  ))}
                </div>
              </details>

              <Button className="w-full" onClick={() => setView('composer')}>
                <Send className="h-4 w-4 mr-2" />
                Gå til afsendelse
              </Button>
            </>
          )}
        </div>
      )}

      {/* ── HISTORY ── */}
      {view === 'history' && (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-sm">Udsendelseshistorik</h3>
              <Badge variant="secondary">{jobs.length} jobs</Badge>
            </div>
            {loadingJobs ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Indlæser…</div>
            ) : jobs.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <Mail className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Ingen udsendelser endnu</p>
                <Button size="sm" variant="outline" onClick={() => setView('composer')}>
                  Opret første udsendelse
                </Button>
              </div>
            ) : (
              <div>
                {jobs.map((job) => (
                  <JobRow
                    key={job.job_id}
                    job={job}
                    onPause={(id) => void jobAction(id, 'pause')}
                    onResume={(id) => void jobAction(id, 'resume')}
                    onCancel={(id) => void jobAction(id, 'cancel')}
                    busy={busy}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
