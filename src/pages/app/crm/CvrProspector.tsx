/**
 * CVR Prospector — Find danske virksomheder via Virk.dk (cvrapi.dk)
 * Ingen API-nøgle nødvendig. Importér direkte som leads.
 */
import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Search, Building2, MapPin, Phone, Mail, Users, Briefcase,
  CheckSquare, Square, Import, Loader2, ChevronRight, X,
  Sparkles, RefreshCw, AlertCircle,
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
}

type ImportStatus = 'idle' | 'importing' | 'done' | 'error';

// ─── Industry presets ──────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Reklamebureauer',    query: 'reklamebureau',        emoji: '📢' },
  { label: 'Digitale bureauer',  query: 'digital bureau',       emoji: '💻' },
  { label: 'Webbureauer',        query: 'webbureau',            emoji: '🌐' },
  { label: 'Marketing',          query: 'marketingbureau',      emoji: '📈' },
  { label: 'PR & kommunikation', query: 'kommunikationsrådgivning', emoji: '📣' },
  { label: 'Designbureauer',     query: 'designbureau',         emoji: '🎨' },
  { label: 'IT-konsulenter',     query: 'it konsulent',         emoji: '🛠️' },
  { label: 'Softwareudvikling',  query: 'softwareudvikling',    emoji: '⚙️' },
  { label: 'E-commerce',         query: 'e-handel webshop',     emoji: '🛒' },
  { label: 'Medieproduktion',    query: 'medieproduktion video', emoji: '🎬' },
];

// ─── CVR lookup ────────────────────────────────────────────────────────────────

async function searchCvr(query: string): Promise<CvrCompany[]> {
  const url = `https://cvrapi.dk/api?search=${encodeURIComponent(query)}&country=dk&maxresults=10`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'CraterCRM/1.0' },
  });
  if (!res.ok) throw new Error(`cvrapi.dk fejl: ${res.status}`);
  const data = await res.json() as CvrCompany & {
    error?: string;
    hits?: CvrCompany[];
  };
  if (data.error) throw new Error(data.error);

  // Combine main result + hits (deduplicated)
  const results: CvrCompany[] = [];
  const seen = new Set<string>();

  const add = (c: CvrCompany) => {
    const key = String(c.vat);
    if (!seen.has(key) && c.name) {
      seen.add(key);
      results.push({ ...c, vat: String(c.vat) });
    }
  };

  add(data);
  (data.hits ?? []).forEach(add);

  return results;
}

// ─── Company Card ──────────────────────────────────────────────────────────────

function CompanyCard({
  company,
  selected,
  imported,
  onToggle,
}: {
  company: CvrCompany;
  selected: boolean;
  imported: boolean;
  onToggle: () => void;
}) {
  const ownerName = company.owners?.[0]?.name;

  return (
    <div
      className={`rounded-2xl border p-4 transition-all cursor-pointer select-none ${
        imported
          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10 opacity-70'
          : selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
      }`}
      onClick={imported ? undefined : onToggle}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
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

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-tight">{company.name}</p>
              {company.companydesc && (
                <Badge variant="outline" className="text-xs shrink-0">{company.companydesc}</Badge>
              )}
            </div>
            {company.industrydesc && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Briefcase className="h-3 w-3 shrink-0" />
                {company.industrydesc}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {(company.address || company.city) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{[company.address, company.zipcode && company.city ? `${company.zipcode} ${company.city}` : company.city].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {company.employees && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3 w-3 shrink-0" />
                <span>{company.employees} ansatte</span>
              </div>
            )}
            {company.phone && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">{company.phone}</span>
              </div>
            )}
            {company.email && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{company.email}</span>
              </div>
            )}
          </div>

          {ownerName && (
            <div className="text-xs text-muted-foreground border-t pt-2 mt-1">
              Ejer: <span className="font-medium text-foreground">{ownerName}</span>
            </div>
          )}

          <div className="text-xs text-muted-foreground font-mono">CVR {company.vat}</div>
        </div>
      </div>

      {imported && (
        <div className="mt-2 text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
          <CheckSquare className="h-3 w-3" />
          Importeret som lead
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CvrProspectorPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CvrCompany[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    setSearchError(null);
    setResults([]);
    setSelected(new Set());
    try {
      const found = await searchCvr(q);
      if (found.length === 0) {
        setSearchError('Ingen virksomheder fundet — prøv et andet søgeord');
      }
      setResults(found);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Søgning mislykkedes';
      setSearchError(msg);
      toast({ title: 'Søgningsfejl', description: msg, variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const pickPreset = async (preset: typeof PRESETS[0]) => {
    setActivePreset(preset.label);
    setQuery(preset.query);
    await doSearch(preset.query);
  };

  const toggleSelect = (vat: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(vat)) next.delete(vat);
      else next.add(vat);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(results.filter(r => !imported.has(r.vat)).map(r => r.vat)));
  };

  const deselectAll = () => setSelected(new Set());

  const importLeads = async () => {
    const toImport = results.filter(r => selected.has(r.vat) && !imported.has(r.vat));
    if (toImport.length === 0) return;

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
        setImportProgress(p => ({ ...p, done: p.done + 1 }));
      } catch {
        failed.push(company.name);
        setImportProgress(p => ({ ...p, done: p.done + 1 }));
      }
      // Lille pause for ikke at overbelaste API
      await new Promise(r => setTimeout(r, 150));
    }

    setImportStatus('done');
    if (failed.length === 0) {
      toast({
        title: `${toImport.length} leads importeret`,
        description: 'Find dem under CRM → Leads',
      });
    } else {
      toast({
        title: `${toImport.length - failed.length} importeret, ${failed.length} fejlede`,
        description: failed.slice(0, 3).join(', '),
        variant: 'destructive',
      });
    }
    setTimeout(() => setImportStatus('idle'), 3000);
  };

  const selectedNotImported = [...selected].filter(v => !imported.has(v));
  const totalImported = imported.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">CVR Prospector</h1>
            <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">Gratis · ingen API-nøgle</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Find danske virksomheder fra Virk.dk og importer dem direkte som leads
          </p>
        </div>
        {totalImported > 0 && (
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-green-600">{totalImported}</p>
            <p className="text-xs text-muted-foreground">leads importeret</p>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setActivePreset(null); }}
              onKeyDown={e => e.key === 'Enter' && doSearch(query)}
              placeholder="Søg virksomhedstype, branche, bynavn..."
              className="pl-9 pr-4"
            />
            {query && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => { setQuery(''); setResults([]); setActivePreset(null); inputRef.current?.focus(); }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button onClick={() => doSearch(query)} disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Søg</span>
          </Button>
        </div>

        {/* Industry presets */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Hurtigt valg — klik for at søge
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.label}
                onClick={() => pickPreset(preset)}
                disabled={searching}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  activePreset === preset.label
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted hover:bg-muted/70 border-transparent text-muted-foreground hover:text-foreground'
                } disabled:opacity-50`}
              >
                <span>{preset.emoji}</span>
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tip */}
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Data hentes direkte fra <strong>Virk.dk</strong> (officielt CVR-register) via cvrapi.dk. Gratis, ingen API-nøgle, maks ~30 søgninger/dag.
            Søg på brancher som "reklamebureauer", bynavne som "København" eller virksomhedsnavne.
          </p>
        </div>
      </div>

      {/* Results */}
      {(results.length > 0 || searching || searchError) && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {searching ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Søger i CVR-registeret...
                </div>
              ) : results.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{results.length}</span> virksomheder fundet
                    {totalImported > 0 && <span className="text-green-600"> · {totalImported} importeret</span>}
                  </p>
                  <div className="flex gap-1">
                    <button className="text-xs text-primary hover:underline" onClick={selectAll}>Vælg alle</button>
                    <span className="text-muted-foreground">·</span>
                    <button className="text-xs text-muted-foreground hover:underline" onClick={deselectAll}>Fravælg</button>
                  </div>
                </>
              ) : null}
            </div>

            {selectedNotImported.length > 0 && (
              <Button
                onClick={importLeads}
                disabled={importStatus === 'importing'}
                className="bg-green-600 hover:bg-green-700 text-white shrink-0"
              >
                {importStatus === 'importing' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {importProgress.done}/{importProgress.total}
                  </>
                ) : (
                  <>
                    <Import className="h-4 w-4 mr-2" />
                    Importér {selectedNotImported.length} leads
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Error */}
          {searchError && !searching && (
            <div className="rounded-2xl border border-dashed p-8 flex flex-col items-center gap-3 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{searchError}</p>
              <Button variant="outline" size="sm" onClick={() => doSearch(query)}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Prøv igen
              </Button>
            </div>
          )}

          {/* Cards grid */}
          {results.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {results.map(company => (
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

          {/* Import success banner */}
          {importStatus === 'done' && (
            <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 px-5 py-4 flex items-center gap-3">
              <CheckSquare className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                  Leads importeret til CRM
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Find dem under CRM → Leads — send dem en email med Bulk Email
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state — initial */}
      {results.length === 0 && !searching && !searchError && (
        <div className="rounded-2xl border border-dashed p-12 flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary/60" />
          </div>
          <div>
            <p className="font-semibold">Find din næste kunde</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Søg efter brancher eller vælg en kategori ovenfor. Data hentes direkte fra det officielle CVR-register.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {PRESETS.slice(0, 4).map(p => (
              <button
                key={p.label}
                onClick={() => pickPreset(p)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted hover:bg-muted/70 text-sm font-medium transition-colors"
              >
                <span>{p.emoji}</span>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
