/**
 * CVR Prospector — Find danske virksomheder via Virk.dk (cvrapi.dk)
 *
 * Multi-søgestrategi: industri × byer = op til 100+ unikke resultater.
 * Ingen API-nøgle nødvendig. Importér direkte som leads.
 */
import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Search, Building2, MapPin, Phone, Mail, Users, Briefcase,
  CheckSquare, Square, Loader2, ChevronRight, X,
  Sparkles, AlertCircle, Download, SlidersHorizontal,
  TrendingUp, Globe, Star,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CvrCompany {
  vat: string;
  name: string;
  address: string;
  zipcode: string;
  city: string;
  phone?: string;
  email?: string;
  industrycode?: number;
  industrydesc?: string;
  employees?: string;
  companydesc?: string;
  owners?: Array<{ name: string }>;
  _score?: number; // relevance scoring
}

type ImportStatus = 'idle' | 'importing' | 'done';

// ─── Danish cities for multi-search sweep ──────────────────────────────────────

const CITIES = [
  'København', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg',
  'Randers', 'Kolding', 'Horsens', 'Vejle', 'Roskilde',
  'Herning', 'Næstved', 'Frederiksberg', 'Silkeborg', 'Holstebro',
  'Taastrup', 'Ballerup', 'Hillerød', 'Slagelse', 'Helsingør',
  'Sønderborg', 'Viborg', 'Fredensborg', 'Køge', 'Elsinore',
];

// ─── Industry presets with multiple search terms for better coverage ────────────

const PRESETS = [
  {
    label: 'Reklamebureauer',
    emoji: '📢',
    terms: ['reklamebureau', 'kreativt bureau', 'advertising'],
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  },
  {
    label: 'Digitale bureauer',
    emoji: '💻',
    terms: ['digital bureau', 'digital markedsføring', 'performance marketing'],
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  {
    label: 'Webbureauer',
    emoji: '🌐',
    terms: ['webbureau', 'webdesign', 'web udvikling'],
    color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  },
  {
    label: 'Marketing',
    emoji: '📈',
    terms: ['marketingbureau', 'marketing konsulent', 'growth marketing'],
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  {
    label: 'PR & kommunikation',
    emoji: '📣',
    terms: ['kommunikationsrådgivning', 'pr bureau', 'public relations'],
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  },
  {
    label: 'Designbureauer',
    emoji: '🎨',
    terms: ['designbureau', 'grafisk design', 'brand design'],
    color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  },
  {
    label: 'IT-konsulenter',
    emoji: '🛠️',
    terms: ['it konsulent', 'teknologirådgivning', 'digital transformation'],
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
  },
  {
    label: 'Softwareudvikling',
    emoji: '⚙️',
    terms: ['softwareudvikling', 'app udvikling', 'systemudvikling'],
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  },
  {
    label: 'E-commerce',
    emoji: '🛒',
    terms: ['e-handel', 'webshop', 'online handel'],
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  {
    label: 'Medieproduktion',
    emoji: '🎬',
    terms: ['medieproduktion', 'videoproduktion', 'content produktion'],
    color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  },
  {
    label: 'SEO & SEM',
    emoji: '🔍',
    terms: ['seo bureau', 'søgemaskineoptimering', 'google ads bureau'],
    color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  },
  {
    label: 'Social media',
    emoji: '📱',
    terms: ['social media bureau', 'influencer marketing', 'sociale medier'],
    color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  },
];

// ─── CVR API ────────────────────────────────────────────────────────────────────

async function cvrSearch(q: string): Promise<CvrCompany[]> {
  const url = `https://cvrapi.dk/api?search=${encodeURIComponent(q)}&country=dk`;
  const res = await fetch(url, { headers: { 'User-Agent': 'CraterCRM/1.0' } });
  if (!res.ok) return [];
  const data = await res.json() as CvrCompany & { error?: string; hits?: CvrCompany[] };
  if (data.error || !data.name) return [];
  const out: CvrCompany[] = [];
  const seen = new Set<string>();
  const add = (c: CvrCompany) => {
    const key = String(c.vat);
    if (!seen.has(key) && c.name) { seen.add(key); out.push({ ...c, vat: key }); }
  };
  add(data);
  (data.hits ?? []).forEach(add);
  return out;
}

/**
 * Multi-search sweep: kombinerer søgeterm × byer for at få mange unikke resultater.
 * fx "reklamebureau" × 25 byer = potentielt 25–75 unikke firmaer.
 */
async function sweepCvr(
  terms: string[],
  cities: string[],
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<CvrCompany[]> {
  // Build query combinations: [term, term+city, city+term]
  const queries: string[] = [];
  for (const term of terms) {
    queries.push(term);
    for (const city of cities) {
      queries.push(`${term} ${city}`);
    }
  }

  const seen = new Set<string>();
  const results: CvrCompany[] = [];
  let done = 0;

  for (const q of queries) {
    if (signal.aborted) break;
    try {
      const batch = await cvrSearch(q);
      for (const c of batch) {
        if (!seen.has(c.vat)) {
          seen.add(c.vat);
          results.push(c);
        }
      }
    } catch { /* skip failed queries */ }
    done++;
    onProgress(done, queries.length);
    // Rate-limit: cvrapi.dk asks for max 1 req/s
    if (!signal.aborted) await new Promise(r => setTimeout(r, 1100));
  }

  return results;
}

// ─── Employee filter ────────────────────────────────────────────────────────────

const EMP_FILTERS = [
  { label: 'Alle', fn: (_: string) => true },
  { label: '1–9', fn: (e: string) => /^[0-9]$/.test(e) || e === '1-4' || e === '5-9' || e === '0-4' },
  { label: '10–49', fn: (e: string) => /^1[0-9]|2[0-9]|3[0-9]|4[0-9]/.test(e) || e === '10-19' || e === '20-49' },
  { label: '50+', fn: (e: string) => /^[5-9][0-9]|[0-9]{3}/.test(e) || e === '50-99' || e === '100+' },
];

// ─── Scoring (has email/phone = higher priority) ───────────────────────────────

function scoreCompany(c: CvrCompany): number {
  let s = 0;
  if (c.email) s += 40;
  if (c.phone) s += 30;
  if (c.employees) s += 15;
  if (c.owners?.length) s += 15;
  return s;
}

// ─── Company Card ──────────────────────────────────────────────────────────────

function CompanyCard({
  company, selected, imported, onToggle,
}: {
  company: CvrCompany; selected: boolean; imported: boolean; onToggle: () => void;
}) {
  const owner = company.owners?.[0]?.name;
  const score = scoreCompany(company);
  return (
    <div
      className={`rounded-2xl border p-4 transition-all cursor-pointer select-none ${
        imported
          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10 opacity-60'
          : selected
          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
          : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
      }`}
      onClick={imported ? undefined : onToggle}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {imported ? (
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
              <p className="text-sm font-semibold leading-tight truncate">{company.name}</p>
              {company.industrydesc && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Briefcase className="h-3 w-3 shrink-0" />
                  <span className="truncate">{company.industrydesc}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {score >= 70 && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
              {company.companydesc && (
                <Badge variant="outline" className="text-xs">{company.companydesc}</Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {(company.address || company.city) && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {[company.address, company.zipcode && company.city ? `${company.zipcode} ${company.city}` : company.city].filter(Boolean).join(', ')}
              </p>
            )}
            {company.employees && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3 w-3 shrink-0" />{company.employees} ansatte
              </p>
            )}
            {company.phone && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                <Phone className="h-3 w-3 shrink-0" />{company.phone}
              </p>
            )}
            {company.email && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                <Mail className="h-3 w-3 shrink-0" />{company.email}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t">
            <span className="text-xs text-muted-foreground font-mono">CVR {company.vat}</span>
            {owner && <span className="text-xs text-muted-foreground truncate ml-2">Ejer: {owner}</span>}
          </div>
        </div>
      </div>

      {imported && (
        <p className="mt-2 text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
          <CheckSquare className="h-3 w-3" />Importeret som lead
        </p>
      )}
    </div>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="rounded-2xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          {label}
        </span>
        <span className="text-muted-foreground tabular-nums">{done} / {total} søgninger</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Søger industri × {CITIES.length} danske byer — finder unikke virksomheder...
      </p>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CvrProspectorPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CvrCompany[]>([]);
  const [sweeping, setSweeping] = useState(false);
  const [sweepProgress, setSweepProgress] = useState({ done: 0, total: 0 });
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [empFilter, setEmpFilter] = useState(0); // index into EMP_FILTERS
  const [withEmailOnly, setWithEmailOnly] = useState(false);
  const [sortByScore, setSortByScore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Single quick search (no city sweep)
  const quickSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearchError(null);
    setResults([]);
    setSelected(new Set());
    setActivePreset(null);
    setSweeping(true);
    setSweepProgress({ done: 0, total: 1 });
    try {
      const found = await cvrSearch(q);
      setSweepProgress({ done: 1, total: 1 });
      if (found.length === 0) setSearchError('Ingen resultater — prøv et andet søgeord');
      setResults(found);
    } catch {
      setSearchError('Søgning mislykkedes');
    } finally {
      setSweeping(false);
    }
  }, []);

  // Full multi-city sweep for a preset
  const runSweep = useCallback(async (preset: typeof PRESETS[0]) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setActivePreset(preset.label);
    setResults([]);
    setSelected(new Set());
    setSearchError(null);
    setSweeping(true);

    // Only use first 8 cities to stay within ~30-40 req/session limit
    const citySubset = CITIES.slice(0, 8);
    const totalQueries = preset.terms.length * (1 + citySubset.length);
    setSweepProgress({ done: 0, total: totalQueries });

    try {
      const found = await sweepCvr(
        preset.terms,
        citySubset,
        (done, total) => setSweepProgress({ done, total }),
        ctrl.signal,
      );
      if (found.length === 0 && !ctrl.signal.aborted) {
        setSearchError('Ingen resultater fundet — prøv manuelt søgeord');
      }
      setResults(found);
    } catch {
      if (!ctrl.signal.aborted) setSearchError('Søgning mislykkedes');
    } finally {
      setSweeping(false);
    }
  }, []);

  const stopSweep = () => {
    abortRef.current?.abort();
    setSweeping(false);
  };

  const toggleSelect = (vat: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(vat)) n.delete(vat); else n.add(vat);
      return n;
    });
  };

  // Apply filters + sorting
  const filtered = results
    .filter(c => !withEmailOnly || !!c.email)
    .filter(c => EMP_FILTERS[empFilter].fn(c.employees ?? ''));

  const sorted = sortByScore
    ? [...filtered].sort((a, b) => scoreCompany(b) - scoreCompany(a))
    : filtered;

  const notImported = sorted.filter(c => !imported.has(c.vat));
  const selectedNotImported = [...selected].filter(v => !imported.has(v));

  const selectAll = () => setSelected(new Set(notImported.map(c => c.vat)));
  const deselectAll = () => setSelected(new Set());

  const withEmail = results.filter(c => c.email).length;
  const withPhone = results.filter(c => c.phone).length;

  // Export CSV
  const exportCsv = () => {
    const rows = [
      ['Navn', 'CVR', 'Virksomhed type', 'Branche', 'Ansatte', 'Adresse', 'By', 'Telefon', 'Email', 'Ejer'],
      ...sorted.map(c => [
        c.name, c.vat, c.companydesc ?? '', c.industrydesc ?? '',
        c.employees ?? '', c.address ?? '', [c.zipcode, c.city].filter(Boolean).join(' '),
        c.phone ?? '', c.email ?? '', c.owners?.[0]?.name ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cvr-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Import to CRM
  const importLeads = async () => {
    const toImport = results.filter(c => selected.has(c.vat) && !imported.has(c.vat));
    if (!toImport.length) return;
    setImportStatus('importing');
    setImportProgress({ done: 0, total: toImport.length });
    const failed: string[] = [];
    for (const company of toImport) {
      try {
        await api.createLead({
          name: company.owners?.[0]?.name || company.name,
          phone: company.phone || '—',
          email: company.email,
          company: company.name,
          status: 'cold',
        });
        setImported(prev => new Set([...prev, company.vat]));
        setSelected(prev => { const n = new Set(prev); n.delete(company.vat); return n; });
      } catch {
        failed.push(company.name);
      }
      setImportProgress(p => ({ ...p, done: p.done + 1 }));
      await new Promise(r => setTimeout(r, 120));
    }
    setImportStatus('done');
    const ok = toImport.length - failed.length;
    toast({
      title: `${ok} leads importeret til CRM`,
      description: failed.length ? `${failed.length} fejlede: ${failed.slice(0, 2).join(', ')}` : 'Find dem under CRM → Leads',
      variant: failed.length > ok ? 'destructive' : 'default',
    });
    setTimeout(() => setImportStatus('idle'), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold">CVR Prospector</h1>
            <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">Gratis · ingen API-nøgle</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-søgning: industri × 8 byer = op til 100+ unikke virksomheder fra Virk.dk
          </p>
        </div>
        {imported.size > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{imported.size}</p>
            <p className="text-xs text-muted-foreground">leads importeret</p>
          </div>
        )}
      </div>

      {/* Search box + presets */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        {/* Search row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setActivePreset(null); }}
              onKeyDown={e => e.key === 'Enter' && quickSearch(query)}
              placeholder="Søg manuelt: fx 'reklamebureauer København'..."
              className="pl-9"
            />
            {query && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setQuery(''); setResults([]); setActivePreset(null); }}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button variant="outline" onClick={() => quickSearch(query)} disabled={sweeping || !query.trim()}>
            {sweeping && !activePreset ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {/* Preset grid */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-2.5 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Vælg branche — søger automatisk i 8 danske byer
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.label}
                onClick={() => !sweeping && runSweep(preset)}
                disabled={sweeping}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border text-left ${
                  activePreset === preset.label
                    ? 'border-primary bg-primary/10 text-primary'
                    : `${preset.color} border-transparent hover:opacity-80`
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <span className="text-base leading-none shrink-0">{preset.emoji}</span>
                <span className="truncate">{preset.label}</span>
                {activePreset === preset.label && sweeping && (
                  <Loader2 className="h-3 w-3 animate-spin ml-auto shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Info bar */}
        <div className="rounded-xl bg-muted/50 px-4 py-2.5 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Data fra <strong>Virk.dk</strong> (officielt CVR-register). Gratis, max ~30–40 søgninger/dag.
            Resultaterne rangeres efter kontaktoplysninger — <Star className="inline h-3 w-3 text-amber-400 fill-amber-400" /> = har email + telefon.
          </p>
        </div>
      </div>

      {/* Sweep progress */}
      {sweeping && (
        <div className="space-y-3">
          <ProgressBar
            done={sweepProgress.done}
            total={sweepProgress.total}
            label={`Sweeper ${activePreset || query}...`}
          />
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={stopSweep}>
              <X className="h-3.5 w-3.5 mr-1.5" />
              Stop søgning (vis resultater)
            </Button>
          </div>
        </div>
      )}

      {/* Results panel */}
      {(sorted.length > 0 || searchError) && !sweeping && (
        <div className="space-y-4">
          {/* Stats bar */}
          {results.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-4 flex-1">
                <div className="text-center">
                  <p className="text-2xl font-bold tabular-nums">{results.length}</p>
                  <p className="text-xs text-muted-foreground">fundet</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold tabular-nums text-blue-600">{withEmail}</p>
                  <p className="text-xs text-muted-foreground">med email</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold tabular-nums text-green-600">{withPhone}</p>
                  <p className="text-xs text-muted-foreground">med tlf.</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold tabular-nums text-purple-600">{imported.size}</p>
                  <p className="text-xs text-muted-foreground">importeret</p>
                </div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => setShowFilters(v => !v)}>
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                Filter
                {(empFilter > 0 || withEmailOnly) && (
                  <Badge variant="default" className="ml-1.5 h-4 px-1 text-xs">{(empFilter > 0 ? 1 : 0) + (withEmailOnly ? 1 : 0)}</Badge>
                )}
              </Button>
              {results.length > 0 && (
                <>
                  <button className="text-xs text-primary hover:underline" onClick={selectAll}>Vælg alle ({notImported.length})</button>
                  <span className="text-muted-foreground text-xs">·</span>
                  <button className="text-xs text-muted-foreground hover:underline" onClick={deselectAll}>Fravælg</button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {results.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  CSV
                </Button>
              )}
              {selectedNotImported.length > 0 && (
                <Button
                  size="sm"
                  onClick={importLeads}
                  disabled={importStatus === 'importing'}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {importStatus === 'importing' ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />{importProgress.done}/{importProgress.total}</>
                  ) : (
                    <><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Importér {selectedNotImported.length} leads<ChevronRight className="h-3.5 w-3.5 ml-1" /></>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Antal ansatte</p>
                  <div className="flex gap-1">
                    {EMP_FILTERS.map((f, i) => (
                      <button
                        key={f.label}
                        onClick={() => setEmpFilter(i)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${empFilter === i ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Kontakt</p>
                  <button
                    onClick={() => setWithEmailOnly(v => !v)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${withEmailOnly ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70'}`}
                  >
                    <Mail className="h-3 w-3" />Kun med email ({withEmail})
                  </button>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Sortering</p>
                  <button
                    onClick={() => setSortByScore(v => !v)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${sortByScore ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70'}`}
                  >
                    <Star className="h-3 w-3" />Bedst kontakt først
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Viser {sorted.length} af {results.length} resultater
              </p>
            </div>
          )}

          {/* Error state */}
          {searchError && (
            <div className="rounded-2xl border border-dashed p-8 text-center space-y-2">
              <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">{searchError}</p>
            </div>
          )}

          {/* Import success */}
          {importStatus === 'done' && (
            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 px-4 py-3 flex items-center gap-3">
              <CheckSquare className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                Leads importeret — find dem under CRM → Leads og start bulk email outreach
              </p>
            </div>
          )}

          {/* Cards */}
          {sorted.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {sorted.map(company => (
                <CompanyCard
                  key={company.vat}
                  company={company}
                  selected={selected.has(company.vat)}
                  imported={imported.has(company.vat)}
                  onToggle={() => toggleSelect(company.vat)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Initial empty state */}
      {results.length === 0 && !sweeping && !searchError && (
        <div className="rounded-2xl border border-dashed p-12 flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary/60" />
          </div>
          <div className="max-w-sm">
            <p className="font-semibold text-lg">Find din næste B2B-kunde</p>
            <p className="text-sm text-muted-foreground mt-1">
              Vælg en branchekategori ovenfor. Systemet søger automatisk på tværs af 8 danske byer og giver dig op til 100+ unikke virksomheder.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full max-w-xs mt-2">
            {PRESETS.slice(0, 4).map(p => (
              <button
                key={p.label}
                onClick={() => runSweep(p)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${p.color} hover:opacity-80`}
              >
                <span>{p.emoji}</span>{p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
