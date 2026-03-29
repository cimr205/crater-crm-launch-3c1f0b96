/**
 * Prospect Engine — Global lead discovery
 *
 * 3-layer architecture:
 *  1. Discovery  — Google Maps scraper (omkarcloud/google-maps-scraper)
 *  2. Enrichment — Website crawler (apify/crawlee) → email, phone, social links
 *  3. Extraction — AI-assisted extraction (unclecode/crawl4ai)
 *
 * The backend runs the scraping jobs. This page:
 *  - Submits job requests to POST /v1/prospect/jobs
 *  - Polls for progress via GET /v1/prospect/jobs/:id
 *  - Displays results and imports selected ones as CRM leads
 *
 * Backend contract (to be implemented with the scraper services):
 *  POST   /v1/prospect/jobs          → create job
 *  GET    /v1/prospect/jobs          → list jobs
 *  GET    /v1/prospect/jobs/:id      → job + results
 *  DELETE /v1/prospect/jobs/:id      → cancel/delete
 *  POST   /v1/prospect/jobs/:id/import → import to CRM
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ProspectJob, type ProspectResult } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Search, Building2, MapPin, Phone, Mail, Users, Globe,
  CheckSquare, Square, Loader2, ChevronRight, X,
  Sparkles, Star, Download, SlidersHorizontal, Clock,
  Trash2, RotateCcw, CheckCircle2, AlertCircle, Zap,
  TrendingUp, ExternalLink,
} from 'lucide-react';

// ─── Example queries ────────────────────────────────────────────────────────────

const EXAMPLES = [
  { label: 'Marketing agencies in London', icon: '🇬🇧' },
  { label: 'Digital bureauer i København', icon: '🇩🇰' },
  { label: 'SaaS companies in Berlin', icon: '🇩🇪' },
  { label: 'Reklamebureauer i Aarhus', icon: '🇩🇰' },
  { label: 'Web design agencies Amsterdam', icon: '🇳🇱' },
  { label: 'PR agencies in Stockholm', icon: '🇸🇪' },
  { label: 'IT consultants Manchester', icon: '🇬🇧' },
  { label: 'Softwarevirksomheder Odense', icon: '🇩🇰' },
];

const SOURCE_OPTIONS = [
  {
    value: 'google_maps',
    label: 'Google Maps',
    desc: 'Finder lokale virksomheder med ratings, telefon og adresse',
    icon: '📍',
    color: 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800',
    activeColor: 'border-red-500 bg-red-50 dark:bg-red-900/20',
    badge: 'Anbefalet',
    badgeColor: 'bg-red-500',
  },
  {
    value: 'combined',
    label: 'Maps + Crawlee',
    desc: 'Google Maps discovery + besøger hvert website for at finde emails',
    icon: '🔗',
    color: 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800',
    activeColor: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
    badge: 'Flest emails',
    badgeColor: 'bg-blue-500',
  },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'lige nu';
  if (mins < 60) return `${mins} min. siden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} t. siden`;
  return `${Math.floor(hours / 24)} d. siden`;
}

function statusColor(status: string) {
  switch (status) {
    case 'queued': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
    case 'running': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
    case 'done': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
    case 'failed': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
    default: return 'text-muted-foreground bg-muted';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'queued': return 'I kø';
    case 'running': return 'Kører';
    case 'done': return 'Færdig';
    case 'failed': return 'Fejlet';
    default: return status;
  }
}

function contactScore(r: ProspectResult): number {
  let s = 0;
  if (r.email) s += 40;
  if (r.phone) s += 30;
  if (r.website) s += 20;
  if (r.rating && r.rating >= 4) s += 10;
  return s;
}

// ─── Job list item ──────────────────────────────────────────────────────────────

function JobCard({
  job, active, onSelect, onDelete,
}: {
  job: ProspectJob; active: boolean; onSelect: () => void; onDelete: () => void;
}) {
  const isRunning = job.status === 'running' || job.status === 'queued';
  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border p-3 cursor-pointer transition-all select-none ${
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : 'border-border bg-card hover:border-primary/40'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{job.query}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${statusColor(job.status)}`}>
              {isRunning && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              {job.status === 'done' && <CheckCircle2 className="h-2.5 w-2.5" />}
              {job.status === 'failed' && <AlertCircle className="h-2.5 w-2.5" />}
              {statusLabel(job.status)}
            </span>
            {job.results_count > 0 && (
              <span className="text-xs text-muted-foreground">{job.results_count} virksomheder</span>
            )}
            {job.imported_count > 0 && (
              <span className="text-xs text-green-600">{job.imported_count} leads</span>
            )}
          </div>
          {isRunning && (
            <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">{relativeTime(job.created_at)}</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-0.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Result card ────────────────────────────────────────────────────────────────

function ResultCard({
  result, selected, onToggle,
}: {
  result: ProspectResult; selected: boolean; onToggle: () => void;
}) {
  const score = contactScore(result);
  return (
    <div
      onClick={result.imported ? undefined : onToggle}
      className={`rounded-2xl border p-4 transition-all select-none ${
        result.imported
          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10 opacity-60'
          : selected
          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20 cursor-pointer'
          : 'border-border bg-card hover:border-primary/40 hover:shadow-sm cursor-pointer'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {result.imported ? (
            <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
              <CheckSquare className="h-3.5 w-3.5 text-white" />
            </div>
          ) : selected ? (
            <CheckSquare className="h-5 w-5 text-primary" />
          ) : (
            <Square className="h-5 w-5 text-muted-foreground/40" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">{result.company_name}</p>
              {result.industry && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{result.industry}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {score >= 70 && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
              {result.rating && (
                <span className="text-xs font-medium text-amber-600">★ {result.rating.toFixed(1)}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {(result.address || result.city) && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {[result.address, result.city, result.country].filter(Boolean).join(', ')}
              </p>
            )}
            {result.employees && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3 w-3 shrink-0" />{result.employees}
              </p>
            )}
            {result.phone && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                <Phone className="h-3 w-3 shrink-0" />{result.phone}
              </p>
            )}
            {result.email && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                <Mail className="h-3 w-3 shrink-0" />{result.email}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t gap-2">
            {result.website ? (
              <a
                href={result.website.startsWith('http') ? result.website : `https://${result.website}`}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-primary hover:underline truncate"
              >
                <Globe className="h-3 w-3 shrink-0" />
                <span className="truncate">{result.website.replace(/^https?:\/\//, '')}</span>
                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
              </a>
            ) : (
              <span className="text-xs text-muted-foreground/50 italic">Intet website</span>
            )}
            {result.reviews && (
              <span className="text-xs text-muted-foreground shrink-0">{result.reviews} anm.</span>
            )}
          </div>

          {result.imported && (
            <p className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />Importeret som lead
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ProspectEnginePage() {
  const { toast } = useToast();

  // Search state
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'google_maps' | 'combined'>('google_maps');
  const [submitting, setSubmitting] = useState(false);

  // Jobs
  const [jobs, setJobs] = useState<ProspectJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobResults, setJobResults] = useState<ProspectResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  // Filter
  const [withEmailOnly, setWithEmailOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Backend note
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load jobs on mount ────────────────────────────────────────────────────────

  const loadJobs = useCallback(async () => {
    try {
      const res = await api.listProspectJobs();
      const list = res.data?.jobs ?? [];
      setJobs(list);
      setBackendAvailable(true);
      return list;
    } catch {
      setBackendAvailable(false);
      return [];
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  // ── Poll active job ───────────────────────────────────────────────────────────

  const loadJobResults = useCallback(async (id: string) => {
    setLoadingResults(true);
    try {
      const res = await api.getProspectJob(id);
      const updatedJob = res.data?.job;
      const results = res.data?.results ?? [];
      if (updatedJob) {
        setJobs(prev => prev.map(j => j.id === id ? updatedJob : j));
      }
      setJobResults(results);
      return updatedJob;
    } catch {
      return null;
    } finally {
      setLoadingResults(false);
    }
  }, []);

  useEffect(() => {
    if (!activeJobId) return;
    void loadJobResults(activeJobId);

    // Poll every 3s while running
    const startPolling = () => {
      pollRef.current = setInterval(async () => {
        const updated = await loadJobResults(activeJobId);
        if (updated?.status === 'done' || updated?.status === 'failed') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          if (updated.status === 'done') {
            toast({ title: `Job færdigt — ${updated.results_count} virksomheder fundet` });
          }
        }
      }, 3000);
    };

    const activeJob = jobs.find(j => j.id === activeJobId);
    if (activeJob?.status === 'running' || activeJob?.status === 'queued') {
      startPolling();
    }

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit new job ────────────────────────────────────────────────────────────

  const submitJob = async () => {
    if (!query.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.createProspectJob({ query: query.trim(), source });
      const job = res.data?.job;
      if (job) {
        setJobs(prev => [job, ...prev]);
        setActiveJobId(job.id);
        setJobResults([]);
        setSelected(new Set());
        setQuery('');
        toast({ title: 'Job oprettet', description: 'Scraperen er i gang — resultater opdateres løbende' });
      }
    } catch (err) {
      toast({
        title: 'Kunne ikke oprette job',
        description: err instanceof Error ? err.message : 'Backend-fejl',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete job ────────────────────────────────────────────────────────────────

  const deleteJob = async (id: string) => {
    try {
      await api.deleteProspectJob(id);
      setJobs(prev => prev.filter(j => j.id !== id));
      if (activeJobId === id) {
        setActiveJobId(null);
        setJobResults([]);
        setSelected(new Set());
      }
    } catch {
      toast({ title: 'Kunne ikke slette job', variant: 'destructive' });
    }
  };

  // ── Import leads ──────────────────────────────────────────────────────────────

  const importLeads = async () => {
    if (!activeJobId || selected.size === 0) return;
    setImporting(true);
    try {
      const res = await api.importProspectResults(activeJobId, [...selected]);
      const imported = res.data?.imported ?? 0;
      const failed = res.data?.failed ?? [];
      setJobResults(prev => prev.map(r => selected.has(r.id) ? { ...r, imported: true } : r));
      setSelected(new Set());
      setJobs(prev => prev.map(j =>
        j.id === activeJobId ? { ...j, imported_count: j.imported_count + imported } : j
      ));
      toast({
        title: `${imported} leads importeret til CRM`,
        description: failed.length ? `${failed.length} fejlede` : 'Find dem under CRM → Leads',
        variant: failed.length > imported ? 'destructive' : 'default',
      });
    } catch (err) {
      toast({
        title: 'Import fejlede',
        description: err instanceof Error ? err.message : 'Prøv igen',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  // ── Export CSV ────────────────────────────────────────────────────────────────

  const exportCsv = () => {
    const rows = [
      ['Navn', 'Website', 'Email', 'Telefon', 'Adresse', 'By', 'Land', 'Branche', 'Ansatte', 'Rating', 'Anmeldelser'],
      ...filteredResults.map(r => [
        r.company_name, r.website ?? '', r.email ?? '', r.phone ?? '',
        r.address ?? '', r.city ?? '', r.country ?? '', r.industry ?? '',
        r.employees ?? '', String(r.rating ?? ''), String(r.reviews ?? ''),
      ]),
    ];
    const csv = rows.map(row => row.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `prospect-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const activeJob = jobs.find(j => j.id === activeJobId);
  const filteredResults = jobResults
    .filter(r => !withEmailOnly || !!r.email)
    .sort((a, b) => contactScore(b) - contactScore(a));

  const notImported = filteredResults.filter(r => !r.imported);
  const selectedNotImported = [...selected].filter(id => !jobResults.find(r => r.id === id)?.imported);
  const withEmail = jobResults.filter(r => r.email).length;
  const withPhone = jobResults.filter(r => r.phone).length;

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold">Prospect Engine</h1>
            <Badge className="bg-violet-500 hover:bg-violet-500 text-white">
              <Zap className="h-3 w-3 mr-1" />Global Lead Engine
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Skriv en søgning — backend finder virksomheder via Google Maps + website crawler
          </p>
        </div>
      </div>

      {/* Backend status banner */}
      {backendAvailable === false && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">Backend-scraper ikke tilsluttet endnu</p>
            <p className="text-amber-700 dark:text-amber-300 mt-0.5">
              Implementér <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded text-xs">POST /v1/prospect/jobs</code> på Railway-API'et med{' '}
              <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded text-xs">omkarcloud/google-maps-scraper</code> +{' '}
              <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded text-xs">apify/crawlee</code>.
              Søgeformularen er klar — UI'et viser resultater så snart backend svarer.
            </p>
          </div>
        </div>
      )}

      {/* Search panel */}
      <div className="rounded-2xl border bg-card p-6 space-y-5">
        {/* Query input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Hvad leder du efter?</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void submitJob()}
                placeholder='fx "marketing agencies in London" eller "reklamebureauer Aarhus"'
                className="pl-9 text-sm"
              />
              {query && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setQuery('')}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button onClick={() => void submitJob()} disabled={submitting || !query.trim()} className="shrink-0">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Find virksomheder
            </Button>
          </div>
        </div>

        {/* Source selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Datakilde</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SOURCE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSource(opt.value)}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  source === opt.value ? opt.activeColor + ' border-2' : opt.color + ' hover:opacity-80'
                }`}
              >
                <span className="text-2xl leading-none mt-0.5">{opt.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className={`text-xs text-white px-1.5 py-0.5 rounded ${opt.badgeColor}`}>{opt.badge}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
                {source === opt.value && <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* Example queries */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Eksempler — klik for at bruge
          </p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map(ex => (
              <button
                key={ex.label}
                onClick={() => { setQuery(ex.label); inputRef.current?.focus(); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-muted hover:bg-muted/70 transition-colors border"
              >
                <span>{ex.icon}</span>
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content — jobs list + results */}
      {jobs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 min-h-0">
          {/* Jobs sidebar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold">Søgejobs ({jobs.length})</h2>
              <button
                onClick={() => void loadJobs()}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Opdater"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
            {jobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                active={job.id === activeJobId}
                onSelect={() => { setActiveJobId(job.id); setSelected(new Set()); }}
                onDelete={() => void deleteJob(job.id)}
              />
            ))}
          </div>

          {/* Results panel */}
          <div className="space-y-4 min-w-0">
            {activeJob ? (
              <>
                {/* Job status */}
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold">{activeJob.query}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(activeJob.status)}`}>
                          {(activeJob.status === 'running' || activeJob.status === 'queued') && <Loader2 className="h-3 w-3 animate-spin" />}
                          {activeJob.status === 'done' && <CheckCircle2 className="h-3 w-3" />}
                          {statusLabel(activeJob.status)}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />{relativeTime(activeJob.created_at)}
                        </span>
                      </div>
                    </div>
                    {activeJob.status === 'done' && (
                      <div className="flex gap-3 text-center">
                        <div>
                          <p className="text-xl font-bold">{activeJob.results_count}</p>
                          <p className="text-xs text-muted-foreground">fundet</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-blue-600">{withEmail}</p>
                          <p className="text-xs text-muted-foreground">emails</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-green-600">{withPhone}</p>
                          <p className="text-xs text-muted-foreground">telefoner</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-purple-600">{activeJob.imported_count}</p>
                          <p className="text-xs text-muted-foreground">leads</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {(activeJob.status === 'running' || activeJob.status === 'queued') && (
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${activeJob.progress}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {activeJob.progress}% færdig — finder og beriger virksomheder...
      </p>
                    </div>
                  )}
                  {activeJob.status === 'failed' && activeJob.error && (
                    <p className="text-sm text-destructive">{activeJob.error}</p>
                  )}
                </div>

                {/* Results toolbar */}
                {filteredResults.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button className="text-xs text-primary hover:underline" onClick={() => setSelected(new Set(notImported.map(r => r.id)))}>
                        Vælg alle ({notImported.length})
                      </button>
                      <span className="text-muted-foreground text-xs">·</span>
                      <button className="text-xs text-muted-foreground hover:underline" onClick={() => setSelected(new Set())}>
                        Fravælg
                      </button>
                      <Button variant="ghost" size="sm" onClick={() => setShowFilters(v => !v)}>
                        <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                        Filter
                        {withEmailOnly && <Badge variant="default" className="ml-1.5 h-4 px-1 text-xs">1</Badge>}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={exportCsv}>
                        <Download className="h-3.5 w-3.5 mr-1.5" />CSV
                      </Button>
                      {selectedNotImported.length > 0 && (
                        <Button
                          size="sm"
                          onClick={() => void importLeads()}
                          disabled={importing}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {importing
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Importerer...</>
                            : <><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Importér {selectedNotImported.length} leads<ChevronRight className="h-3.5 w-3.5 ml-1" /></>
                          }
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Filter bar */}
                {showFilters && (
                  <div className="rounded-xl border bg-muted/30 p-3 flex items-center gap-4 flex-wrap">
                    <button
                      onClick={() => setWithEmailOnly(v => !v)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${withEmailOnly ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70'}`}
                    >
                      <Mail className="h-3 w-3" />Kun med email ({withEmail})
                    </button>
                    <p className="text-xs text-muted-foreground ml-auto">
                      Viser {filteredResults.length} af {jobResults.length}
                    </p>
                  </div>
                )}

                {/* Results grid */}
                {loadingResults && filteredResults.length === 0 ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredResults.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredResults.map(result => (
                      <ResultCard
                        key={result.id}
                        result={result}
                        selected={selected.has(result.id)}
                        onToggle={() => toggleSelect(result.id)}
                      />
                    ))}
                  </div>
                ) : activeJob.status === 'done' ? (
                  <div className="rounded-2xl border border-dashed p-10 text-center space-y-2">
                    <Building2 className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                    <p className="text-sm text-muted-foreground">Ingen resultater fundet for denne søgning</p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed p-12 flex flex-col items-center gap-3 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Vælg et job til venstre for at se resultater</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {jobs.length === 0 && backendAvailable !== false && (
        <div className="rounded-2xl border border-dashed p-16 flex flex-col items-center gap-5 text-center">
          <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Globe className="h-10 w-10 text-primary/60" />
          </div>
          <div className="max-w-md">
            <p className="font-semibold text-xl">Find din næste B2B-kunde globalt</p>
            <p className="text-sm text-muted-foreground mt-2">
              Skriv hvad du leder efter ovenfor — fx "marketing agencies in London".
              Backend-scraperen finder automatisk virksomheder via Google Maps og beriger dem med emails fra deres websites.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-left max-w-sm w-full">
            {[
              { icon: '📍', label: 'Google Maps', desc: 'Discovery' },
              { icon: '🕷️', label: 'Crawlee', desc: 'Email enrichment' },
              { icon: '🤖', label: 'Crawl4AI', desc: 'AI extraction' },
            ].map(l => (
              <div key={l.label} className="rounded-xl bg-muted/50 p-3 text-center">
                <div className="text-2xl mb-1">{l.icon}</div>
                <p className="text-xs font-semibold">{l.label}</p>
                <p className="text-xs text-muted-foreground">{l.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
