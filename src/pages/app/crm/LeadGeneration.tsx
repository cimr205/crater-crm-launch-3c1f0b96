import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Search,
  Filter,
  Download,
  Save,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  X,
  Globe,
  Mail,
  Phone,
  Building2,
  MapPin,
  Users,
  Star,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Bookmark,
  Trash2,
  Info,
} from 'lucide-react';
import { buildIndustryKeywords } from '@/lib/crm/industryMap';
import {
  useCreateLeadGenSession,
  useLeadGenSession,
  useCancelLeadGenSession,
  useImportLeadGenResults,
  useLeadGenSavedSearches,
  useSaveLeadGenSearch,
  useDeleteLeadGenSavedSearch,
} from '@/hooks/api/useLeadGeneration';
import type { LeadGenResult, LeadGenSession } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchFilters {
  country: string;
  city: string;
  industry: string;
  employee_size: string;
  must_have_email: boolean;
  must_have_phone: boolean;
  must_have_website: boolean;
  must_be_active: boolean;
  keywords: string;
  exclude_keywords: string;
  score_threshold: number;
}

const DEFAULT_FILTERS: SearchFilters = {
  country: 'dk',
  city: '',
  industry: '',
  employee_size: '',
  must_have_email: false,
  must_have_phone: false,
  must_have_website: false,
  must_be_active: true,
  keywords: '',
  exclude_keywords: '',
  score_threshold: 0,
};

const COUNTRIES = [
  { value: 'dk', label: '🇩🇰 Denmark' },
  { value: 'no', label: '🇳🇴 Norway' },
  { value: 'se', label: '🇸🇪 Sweden' },
  { value: 'de', label: '🇩🇪 Germany' },
  { value: 'gb', label: '🇬🇧 United Kingdom' },
];

const EMPLOYEE_SIZES = [
  { value: '', label: 'Any size' },
  { value: '1-5', label: '1–5 employees' },
  { value: '6-20', label: '6–20 employees' },
  { value: '21-50', label: '21–50 employees' },
  { value: '51-200', label: '51–200 employees' },
  { value: '200+', label: '200+ employees' },
];

// ── Helper components ─────────────────────────────────────────────────────────

function ActiveBadge({ status }: { status: LeadGenResult['active_status'] }) {
  if (status === 'active_likely') {
    return (
      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Active
      </Badge>
    );
  }
  if (status === 'inactive_likely') {
    return (
      <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1">
        <X className="h-3 w-3" />
        Inactive
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 gap-1">
      <AlertCircle className="h-3 w-3" />
      Uncertain
    </Badge>
  );
}

function EmailBadge({ status }: { status: LeadGenResult['email_status'] }) {
  if (status === 'verified') {
    return (
      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Verified
      </Badge>
    );
  }
  if (status === 'likely_valid') {
    return (
      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 gap-1">
        <Mail className="h-3 w-3" />
        Likely valid
      </Badge>
    );
  }
  if (status === 'unverified') {
    return (
      <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 gap-1">
        <AlertCircle className="h-3 w-3" />
        Unverified
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1">
      <X className="h-3 w-3" />
      No email
    </Badge>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? 'bg-green-500/15 text-green-400 border-green-500/30'
      : score >= 40
      ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
      : 'bg-red-500/15 text-red-400 border-red-500/30';
  return <Badge className={color}>{score}</Badge>;
}

// ── Preview drawer ────────────────────────────────────────────────────────────

function LeadPreviewDrawer({
  result,
  open,
  onClose,
  onImport,
  importing,
}: {
  result: LeadGenResult | null;
  open: boolean;
  onClose: () => void;
  onImport: (id: string) => void;
  importing: boolean;
}) {
  if (!result) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            {result.company_name}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <ActiveBadge status={result.active_status} />
            <EmailBadge status={result.email_status} />
            <ScoreBadge score={result.lead_score} />
            {result.imported && (
              <Badge className="bg-primary/15 text-primary border-primary/30">Saved</Badge>
            )}
          </div>

          {/* Description */}
          {result.description && (
            <p className="text-sm text-muted-foreground">{result.description}</p>
          )}

          {/* Contact details */}
          <div className="space-y-2">
            {result.business_email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${result.business_email}`} className="text-primary hover:underline break-all">
                  {result.business_email}
                </a>
              </div>
            )}
            {result.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{result.phone}</span>
              </div>
            )}
            {result.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={result.website} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline break-all">
                  {result.website}
                </a>
              </div>
            )}
            {(result.city || result.country) && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{[result.city, result.region, result.country?.toUpperCase()].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {result.employee_estimate && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{result.employee_estimate} employees</span>
              </div>
            )}
          </div>

          {/* Industry */}
          {result.industry && (
            <div className="text-sm">
              <span className="text-muted-foreground">Industry: </span>
              <span>{result.industry}{result.sub_industry ? ` · ${result.sub_industry}` : ''}</span>
            </div>
          )}

          {/* Decision maker */}
          {(result.owner_name || result.decision_maker_name) && (
            <div className="rounded-lg border border-border p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Decision maker</p>
              {result.decision_maker_name && (
                <p className="text-sm font-medium">{result.decision_maker_name}</p>
              )}
              {result.decision_maker_role && (
                <p className="text-xs text-muted-foreground">{result.decision_maker_role}</p>
              )}
              {result.owner_name && !result.decision_maker_name && (
                <p className="text-sm font-medium">{result.owner_name}</p>
              )}
            </div>
          )}

          {/* Social links */}
          <div className="flex flex-wrap gap-2">
            {result.linkedin_url && (
              <a href={result.linkedin_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1">
                  <ExternalLink className="h-3 w-3" />
                  LinkedIn
                </Button>
              </a>
            )}
            {result.facebook_url && (
              <a href={result.facebook_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Facebook
                </Button>
              </a>
            )}
            {result.source_url && (
              <a href={result.source_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Source
                </Button>
              </a>
            )}
          </div>

          {/* Notes */}
          {result.notes && (
            <div className="text-sm text-muted-foreground border-l-2 border-border pl-3">
              {result.notes}
            </div>
          )}

          {/* Import button */}
          {!result.imported && (
            <Button
              className="w-full"
              onClick={() => onImport(result.id)}
              disabled={importing}
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save as CRM Lead
            </Button>
          )}
          {result.imported && (
            <Badge className="w-full justify-center py-2 bg-green-500/15 text-green-400 border-green-500/30">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Saved to CRM
            </Badge>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LeadGenerationPage() {
  const { t } = useI18n();
  const { toast } = useToast();

  // Search state
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  // Session state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [results, setResults] = useState<LeadGenResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Preview drawer
  const [previewResult, setPreviewResult] = useState<LeadGenResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Save search dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savedSearchName, setSavedSearchName] = useState('');

  // Page
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // Mutations
  const createSession = useCreateLeadGenSession();
  const cancelSession = useCancelLeadGenSession();
  const importResults = useImportLeadGenResults();
  const saveSearch = useSaveLeadGenSearch();
  const deleteSearch = useDeleteLeadGenSavedSearch();

  // Poll active session
  const isRunning =
    activeSessionId != null &&
    (results.length === 0 || createSession.isPending);

  const { data: sessionData, isLoading: sessionLoading } = useLeadGenSession(
    activeSessionId,
    true  // always poll while session exists — hook uses refetchInterval=3s
  );

  // Sync results from polled session
  useEffect(() => {
    if (!sessionData?.data) return;
    const { session, results: r } = sessionData.data;
    if (r && r.length > 0) setResults(r);
    // Stop polling indicator when done
    if (session.status === 'done' || session.status === 'failed' || session.status === 'cancelled') {
      if (session.status === 'failed') {
        toast({ title: session.error_message ?? t('leadGen.searchError'), variant: 'destructive' });
      }
    }
  }, [sessionData, t, toast]);

  const activeSession: LeadGenSession | undefined = sessionData?.data?.session;
  const isSessionRunning = activeSession?.status === 'running' || activeSession?.status === 'pending';

  // Saved searches
  const { data: savedSearchesData } = useLeadGenSavedSearches();
  const savedSearches = savedSearchesData?.data?.saved ?? [];

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!query.trim() && !filters.industry.trim()) {
      toast({ title: 'Please describe the leads you are looking for.', variant: 'destructive' });
      return;
    }

    // Expand industry keywords using intent map
    const industryKeywords = filters.industry ? buildIndustryKeywords(filters.industry) : undefined;

    setResults([]);
    setSelectedIds(new Set());
    setPage(1);

    try {
      const res = await createSession.mutateAsync({
        query: query.trim(),
        filters: {
          ...filters,
          industry_keywords: industryKeywords,
        },
      });
      setActiveSessionId(res.data.session.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('leadGen.searchError');
      toast({ title: message, variant: 'destructive' });
    }
  }, [query, filters, createSession, toast, t]);

  const handleCancel = useCallback(async () => {
    if (!activeSessionId) return;
    await cancelSession.mutateAsync(activeSessionId);
  }, [activeSessionId, cancelSession]);

  const handleImportSingle = useCallback(async (resultId: string) => {
    if (!activeSessionId) return;
    try {
      await importResults.mutateAsync({ sessionId: activeSessionId, resultIds: [resultId] });
      setResults(prev => prev.map(r => r.id === resultId ? { ...r, imported: true } : r));
      toast({ title: 'Lead saved to CRM' });
      setPreviewOpen(false);
    } catch {
      toast({ title: 'Could not save lead', variant: 'destructive' });
    }
  }, [activeSessionId, importResults, toast]);

  const handleBulkImport = useCallback(async () => {
    if (!activeSessionId || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    try {
      const res = await importResults.mutateAsync({ sessionId: activeSessionId, resultIds: ids });
      setResults(prev => prev.map(r => ids.includes(r.id) ? { ...r, imported: true } : r));
      setSelectedIds(new Set());
      toast({ title: `${res.data.imported} leads saved to CRM` });
    } catch {
      toast({ title: t('leadGen.bulkSaveError'), variant: 'destructive' });
    }
  }, [activeSessionId, selectedIds, importResults, toast, t]);

  const handleSelectAll = useCallback(() => {
    const visible = paginatedResults.filter(r => !r.imported).map(r => r.id);
    if (visible.every(id => selectedIds.has(id))) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visible.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visible.forEach(id => next.add(id));
        return next;
      });
    }
  }, [selectedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeduplicate = useCallback(() => {
    const seen = new Set<string>();
    setResults(prev => prev.filter(r => {
      const key = (r.domain || r.company_name).toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
  }, []);

  const handleExportCsv = useCallback(() => {
    const rows = results.filter(r => selectedIds.size === 0 || selectedIds.has(r.id));
    if (rows.length === 0) {
      toast({ title: 'No results to export' });
      return;
    }
    const headers = [
      'company_name','website','business_email','email_status','phone',
      'country','city','region','industry','employee_estimate',
      'active_status','lead_score','source_url','contact_page_url',
      'owner_name','decision_maker_name','decision_maker_role','notes',
    ];
    const escape = (v: string | undefined) => {
      if (!v) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => escape((r as Record<string, unknown>)[h] as string)).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, selectedIds, toast]);

  const handleSaveSearch = useCallback(async () => {
    if (!savedSearchName.trim()) return;
    try {
      await saveSearch.mutateAsync({
        name: savedSearchName.trim(),
        query,
        filters: filters as Record<string, unknown>,
      });
      setSaveDialogOpen(false);
      setSavedSearchName('');
      toast({ title: 'Search saved' });
    } catch {
      toast({ title: 'Could not save search', variant: 'destructive' });
    }
  }, [savedSearchName, query, filters, saveSearch, toast]);

  const handleLoadSavedSearch = useCallback((saved: { query: string; filters: Record<string, unknown> }) => {
    setQuery(saved.query ?? '');
    setFilters({ ...DEFAULT_FILTERS, ...(saved.filters as Partial<SearchFilters>) });
  }, []);

  // Pagination
  const paginatedResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('leadGen.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('leadGen.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
          <Info className="h-3 w-3" />
          {t('leadGen.onlyLeadSearch')}
        </div>
      </div>

      {/* Saved searches */}
      {savedSearches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {savedSearches.map(s => (
            <div key={s.id} className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-7 text-xs"
                onClick={() => handleLoadSavedSearch(s)}
              >
                <Bookmark className="h-3 w-3" />
                {s.name}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => deleteSearch.mutate(s.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('leadGen.searchPlaceholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            disabled={isSessionRunning}
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowFilters(v => !v)}
          className={showFilters ? 'bg-muted' : ''}
        >
          <Filter className="h-4 w-4" />
        </Button>

        {isSessionRunning ? (
          <Button variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        ) : (
          <Button onClick={handleSearch} disabled={createSession.isPending}>
            {createSession.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            {t('leadGen.searchBtn')}
          </Button>
        )}
      </div>

      {/* Advanced filters */}
      <Collapsible open={showFilters}>
        <CollapsibleContent>
          <div className="rounded-lg border border-border bg-card/50 p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Country */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('leadGen.country')}
              </label>
              <Select value={filters.country} onValueChange={v => setFilters(f => ({ ...f, country: v }))}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* City */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('leadGen.city')}
              </label>
              <Input
                className="h-8"
                placeholder="e.g. Copenhagen"
                value={filters.city}
                onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}
              />
            </div>

            {/* Industry */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('leadGen.industry')}
              </label>
              <Input
                className="h-8"
                placeholder="e.g. craftsmen, restaurants"
                value={filters.industry}
                onChange={e => setFilters(f => ({ ...f, industry: e.target.value }))}
              />
            </div>

            {/* Employee size */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('leadGen.employeeSize')}
              </label>
              <Select value={filters.employee_size} onValueChange={v => setFilters(f => ({ ...f, employee_size: v }))}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Any size" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_SIZES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Keywords */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('leadGen.keywords')}
              </label>
              <Input
                className="h-8"
                placeholder="keyword1, keyword2"
                value={filters.keywords}
                onChange={e => setFilters(f => ({ ...f, keywords: e.target.value }))}
              />
            </div>

            {/* Exclude keywords */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('leadGen.excludeKeywords')}
              </label>
              <Input
                className="h-8"
                placeholder="word1, word2"
                value={filters.exclude_keywords}
                onChange={e => setFilters(f => ({ ...f, exclude_keywords: e.target.value }))}
              />
            </div>

            {/* Min score */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('leadGen.scoreThreshold')} ({filters.score_threshold})
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={10}
                value={filters.score_threshold}
                onChange={e => setFilters(f => ({ ...f, score_threshold: Number(e.target.value) }))}
                className="w-full accent-primary"
              />
            </div>

            {/* Boolean toggles */}
            <div className="space-y-2 col-span-2 md:col-span-1">
              {[
                { key: 'must_have_email', label: t('leadGen.mustHaveEmail') },
                { key: 'must_have_phone', label: t('leadGen.mustHavePhone') },
                { key: 'must_have_website', label: t('leadGen.mustHaveWebsite') },
                { key: 'must_be_active', label: t('leadGen.mustBeActive') },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={filters[key as keyof SearchFilters] as boolean}
                    onCheckedChange={checked =>
                      setFilters(f => ({ ...f, [key]: !!checked }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Progress bar when running */}
      {isSessionRunning && activeSession && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{activeSession.progress_label ?? t('leadGen.searching')}</span>
            </div>
            <span className="text-muted-foreground">
              {activeSession.results_count} found
            </span>
          </div>
          <Progress value={activeSession.progress} className="h-2" />
        </div>
      )}

      {/* Results toolbar */}
      {results.length > 0 && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {results.length} {t('leadGen.results')}
              {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={handleDeduplicate}>
              <X className="h-3 w-3" />
              {t('leadGen.deduplicate')}
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setSaveDialogOpen(true)}>
              <Save className="h-3 w-3" />
              {t('leadGen.savedSearch')}
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={handleExportCsv}>
              <Download className="h-3 w-3" />
              {t('leadGen.exportCsv')}
            </Button>
            {selectedIds.size > 0 && (
              <Button size="sm" className="gap-1" onClick={handleBulkImport} disabled={importResults.isPending}>
                {importResults.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                {t('leadGen.saveSelected')} ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Results table */}
      {results.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      paginatedResults.filter(r => !r.imported).length > 0 &&
                      paginatedResults.filter(r => !r.imported).every(r => selectedIds.has(r.id))
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>{t('leadGen.activeStatus')}</TableHead>
                <TableHead>{t('leadGen.emailStatus')}</TableHead>
                <TableHead>{t('leadGen.score')}</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedResults.map(r => (
                <TableRow
                  key={r.id}
                  className={r.imported ? 'opacity-50' : 'cursor-pointer hover:bg-muted/30'}
                  onClick={() => { setPreviewResult(r); setPreviewOpen(true); }}
                >
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox
                      disabled={r.imported}
                      checked={selectedIds.has(r.id)}
                      onCheckedChange={checked => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (checked) { next.add(r.id); } else { next.delete(r.id); }
                          return next;
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{r.company_name}</div>
                    {r.website && (
                      <a
                        href={r.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                      >
                        <Globe className="h-3 w-3" />
                        {r.domain ?? r.website}
                      </a>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.business_email ? (
                      <span className="text-xs">{r.business_email}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{r.phone ?? '—'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {[r.city, r.country?.toUpperCase()].filter(Boolean).join(', ') || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ActiveBadge status={r.active_status} />
                  </TableCell>
                  <TableCell>
                    <EmailBadge status={r.email_status} />
                  </TableCell>
                  <TableCell>
                    <ScoreBadge score={r.lead_score} />
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {r.source_url && (
                        <a href={r.source_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </a>
                      )}
                      {!r.imported ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={importResults.isPending}
                          onClick={() => handleImportSingle(r.id)}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Badge className="text-xs bg-green-500/15 text-green-400 border-green-500/30">✓</Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isSessionRunning && results.length === 0 && !createSession.isPending && (
        <div className="rounded-lg border border-border border-dashed p-12 text-center">
          <Search className="h-10 w-10 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground">{t('leadGen.emptyState')}</p>
        </div>
      )}

      {/* No results after search */}
      {!isSessionRunning && activeSession?.status === 'done' && results.length === 0 && (
        <div className="rounded-lg border border-border p-8 text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t('leadGen.noResults')}</p>
        </div>
      )}

      {/* Preview drawer */}
      <LeadPreviewDrawer
        result={previewResult}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onImport={handleImportSingle}
        importing={importResults.isPending}
      />

      {/* Save search dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('leadGen.savedSearch')}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t('leadGen.savedSearchName')}
            value={savedSearchName}
            onChange={e => setSavedSearchName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveSearch(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSearch} disabled={!savedSearchName.trim() || saveSearch.isPending}>
              {saveSearch.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
