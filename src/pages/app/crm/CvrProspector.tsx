/**
 * Registry Prospector — Find virksomheder via officielle, gratis statsregistre
 *
 * Lande & kilder (ingen API-nøgler, 100% gratis for alle brugere):
 *  🇩🇰 Danmark  — cvrapi.dk       (Erhvervsstyrelsen CVR)
 *  🇳🇴 Norge    — brreg.no        (Brønnøysundregistrene)
 *  🇸🇪 Sverige  — opencorporates  (Bolagsverket-data, gratis tier)
 *  🇩🇪 Tyskland — opencorporates  (Handelsregister-data, gratis tier)
 *  🇬🇧 UK       — companies house (Companies House API, proxy via backend)
 *
 * Multi-sweep: industri × byer = op til 150+ unikke resultater pr. session
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
  TrendingUp, Globe, Star, Flag,
} from 'lucide-react';

// ─── Unified company type ───────────────────────────────────────────────────────

interface RegistryCompany {
  id: string;          // unique: country:vat
  vat: string;
  name: string;
  address?: string;
  zipcode?: string;
  city?: string;
  country: 'dk' | 'no' | 'se' | 'de' | 'uk';
  phone?: string;
  email?: string;
  industry?: string;
  employees?: string;
  companyType?: string;
  status?: string;
  owner?: string;
}

type ImportStatus = 'idle' | 'importing' | 'done';

// ─── Country config ─────────────────────────────────────────────────────────────

const COUNTRIES = {
  dk: { flag: '🇩🇰', label: 'Danmark', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  no: { flag: '🇳🇴', label: 'Norge',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  se: { flag: '🇸🇪', label: 'Sverige', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  de: { flag: '🇩🇪', label: 'Tyskland', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-300' },
  uk: { flag: '🇬🇧', label: 'UK',      color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
} as const;

// ─── Cities per country for sweep ──────────────────────────────────────────────

const CITIES_DK = ['København', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg', 'Kolding', 'Horsens', 'Randers'];
const CITIES_NO = ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Kristiansand', 'Tromsø', 'Drammen', 'Fredrikstad'];
const CITIES_SE = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping', 'Örebro', 'Västerås', 'Helsingborg'];
const CITIES_DE = ['Berlin', 'München', 'Hamburg', 'Frankfurt', 'Köln', 'Stuttgart', 'Düsseldorf', 'Leipzig'];
const CITIES_UK = ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Bristol', 'Leeds', 'Glasgow', 'Liverpool'];

// ─── Industry presets ───────────────────────────────────────────────────────────

const PRESETS = [
  {
    label: 'Reklamebureauer', emoji: '📢',
    dk: ['reklamebureau', 'kreativt bureau'],
    no: ['reklamebyrå', 'kreativt byrå'],
    se: ['reklambyrå', 'kreativ byrå'],
    de: ['Werbeagentur', 'kreative Agentur'],
    uk: ['advertising agency', 'creative agency'],
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  },
  {
    label: 'Digitale bureauer', emoji: '💻',
    dk: ['digital bureau', 'digital markedsføring'],
    no: ['digital markedsføring', 'digitalbyrå'],
    se: ['digital marknadsföring', 'digitalbyrå'],
    de: ['Digitalagentur', 'digitales Marketing'],
    uk: ['digital marketing agency', 'performance marketing'],
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  {
    label: 'Webbureauer', emoji: '🌐',
    dk: ['webbureau', 'webdesign'],
    no: ['webdesign', 'webbyrå'],
    se: ['webbyrå', 'webbdesign'],
    de: ['Webdesign Agentur', 'Webentwicklung'],
    uk: ['web design agency', 'web development'],
    color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  },
  {
    label: 'Marketing', emoji: '📈',
    dk: ['marketingbureau', 'marketing konsulent'],
    no: ['markedsføringsbyrå', 'marketing'],
    se: ['marknadsföringsbyrå', 'marknadskonsult'],
    de: ['Marketingagentur', 'Marketing Beratung'],
    uk: ['marketing agency', 'growth marketing'],
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  {
    label: 'PR & kommunikation', emoji: '📣',
    dk: ['kommunikationsrådgivning', 'pr bureau'],
    no: ['kommunikasjonsbyrå', 'pr byrå'],
    se: ['kommunikationsbyrå', 'pr-byrå'],
    de: ['PR Agentur', 'Kommunikationsagentur'],
    uk: ['pr agency', 'public relations'],
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  },
  {
    label: 'Designbureauer', emoji: '🎨',
    dk: ['designbureau', 'grafisk design'],
    no: ['designbyrå', 'grafisk design'],
    se: ['designbyrå', 'grafisk design'],
    de: ['Designagentur', 'grafisches Design'],
    uk: ['design agency', 'brand design'],
    color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  },
  {
    label: 'IT-konsulenter', emoji: '🛠️',
    dk: ['it konsulent', 'teknologirådgivning'],
    no: ['it konsulent', 'teknologirådgivning'],
    se: ['it-konsult', 'teknikrådgivning'],
    de: ['IT Beratung', 'Technologieberatung'],
    uk: ['it consulting', 'technology consulting'],
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
  },
  {
    label: 'Softwareudvikling', emoji: '⚙️',
    dk: ['softwareudvikling', 'app udvikling'],
    no: ['programvareutvikling', 'apputvikling'],
    se: ['programvaruutveckling', 'apputveckling'],
    de: ['Softwareentwicklung', 'App Entwicklung'],
    uk: ['software development', 'app development'],
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  },
  {
    label: 'SEO & SEM', emoji: '🔍',
    dk: ['seo bureau', 'søgemaskineoptimering'],
    no: ['seo byrå', 'søkemotoroptimalisering'],
    se: ['seo-byrå', 'sökmotoroptimering'],
    de: ['SEO Agentur', 'Suchmaschinenoptimierung'],
    uk: ['seo agency', 'search marketing'],
    color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  },
  {
    label: 'Social media', emoji: '📱',
    dk: ['social media bureau', 'sociale medier'],
    no: ['sosiale medier', 'instagram markedsføring'],
    se: ['sociala medier byrå', 'influencer marketing'],
    de: ['Social Media Agentur', 'Influencer Marketing'],
    uk: ['social media agency', 'influencer marketing'],
    color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  },
  {
    label: 'E-commerce', emoji: '🛒',
    dk: ['e-handel', 'webshop'],
    no: ['netthandel', 'nettbutikk'],
    se: ['e-handel', 'näthandel'],
    de: ['E-Commerce Agentur', 'Online Shop'],
    uk: ['ecommerce agency', 'shopify agency'],
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  {
    label: 'Medieproduktion', emoji: '🎬',
    dk: ['videoproduktion', 'medieproduktion'],
    no: ['videoproduksjon', 'medieproduksjon'],
    se: ['videoproduktion', 'medieproduktion'],
    de: ['Videoproduktion', 'Medienproduktion'],
    uk: ['video production', 'content production'],
    color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  },
] as const;

// ─── API adapters ───────────────────────────────────────────────────────────────

async function searchCvr(q: string): Promise<RegistryCompany[]> {
  try {
    const res = await fetch(
      `https://cvrapi.dk/api?search=${encodeURIComponent(q)}&country=dk`,
      { headers: { 'User-Agent': 'CraterCRM/1.0' } }
    );
    if (!res.ok) return [];
    const data = await res.json() as {
      error?: string; name?: string; vat?: string; address?: string;
      zipcode?: string; city?: string; phone?: string; email?: string;
      industrydesc?: string; employees?: string; companydesc?: string;
      owners?: Array<{ name: string }>; hits?: RegistryCompany[];
    };
    if (data.error || !data.name) return [];
    const out: RegistryCompany[] = [];
    const seen = new Set<string>();
    const add = (c: typeof data) => {
      if (!c.vat || !c.name || seen.has(String(c.vat))) return;
      seen.add(String(c.vat));
      // owners fra CVR er juridiske ejere (typisk holdingselskaber) — vises i kortet men bruges ikke som kontaktnavn
      const ownerName = c.owners?.[0]?.name;
      const isPersonOwner = ownerName && !/\b(aps|a\/s|holding|invest|group|gruppe)\b/i.test(ownerName);
      out.push({
        id: `dk:${c.vat}`, vat: String(c.vat), name: c.name, country: 'dk',
        address: c.address, zipcode: c.zipcode, city: c.city,
        phone: c.phone, email: c.email,
        industry: c.industrydesc, employees: c.employees,
        companyType: c.companydesc,
        owner: isPersonOwner ? ownerName : undefined,
      });
    };
    add(data);
    (data.hits ?? []).forEach(h => add(h as typeof data));
    return out;
  } catch { return []; }
}

async function searchBrreg(q: string): Promise<RegistryCompany[]> {
  try {
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(q)}&size=20`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return [];
    const data = await res.json() as {
      _embedded?: {
        enheter?: Array<{
          organisasjonsnummer?: string;
          navn?: string;
          forretningsadresse?: { adresse?: string[]; postnummer?: string; poststed?: string };
          naeringskode1?: { beskrivelse?: string };
          antallAnsatte?: number;
          organisasjonsform?: { beskrivelse?: string };
          konkurs?: boolean;
          underAvvikling?: boolean;
        }>
      }
    };
    return (data._embedded?.enheter ?? [])
      .filter(e => e.organisasjonsnummer && e.navn && !e.konkurs && !e.underAvvikling)
      .map(e => ({
        id: `no:${e.organisasjonsnummer}`,
        vat: e.organisasjonsnummer!,
        name: e.navn!,
        country: 'no' as const,
        address: e.forretningsadresse?.adresse?.[0],
        zipcode: e.forretningsadresse?.postnummer,
        city: e.forretningsadresse?.poststed,
        industry: e.naeringskode1?.beskrivelse,
        employees: e.antallAnsatte != null ? String(e.antallAnsatte) : undefined,
        companyType: e.organisasjonsform?.beskrivelse,
      }));
  } catch { return []; }
}

// OpenCorporates gratis tier — ingen API-nøgle, dækker SE (Bolagsverket) og DE (Handelsregister)
async function searchOpenCorporates(q: string, jurisdiction: 'se' | 'de'): Promise<RegistryCompany[]> {
  try {
    const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(q)}&jurisdiction_code=${jurisdiction}&inactive=false&per_page=20`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json() as {
      results?: {
        companies?: Array<{
          company?: {
            company_number?: string;
            name?: string;
            registered_address_in_full?: string;
            company_type?: string;
            current_status?: string;
            inactive?: boolean;
          }
        }>
      }
    };
    return (data.results?.companies ?? [])
      .map(c => c.company)
      .filter((c): c is NonNullable<typeof c> => !!c?.company_number && !!c?.name && !c?.inactive)
      .map(c => ({
        id: `${jurisdiction}:${c.company_number}`,
        vat: c.company_number!,
        name: c.name!,
        country: jurisdiction,
        address: c.registered_address_in_full,
        companyType: c.company_type,
        status: c.current_status ?? undefined,
      }));
  } catch { return []; }
}

async function searchCompaniesHouse(q: string): Promise<RegistryCompany[]> {
  try {
    const res = await api.request<{
      items?: Array<{
        company_number?: string;
        title?: string;
        address_snippet?: string;
        company_type?: string;
        company_status?: string;
        date_of_creation?: string;
      }>
    }>(`/v1/companies-house/search?q=${encodeURIComponent(q)}`);
    return (res.items ?? [])
      .filter(c => c.company_number && c.title && c.company_status === 'active')
      .map(c => ({
        id: `uk:${c.company_number}`,
        vat: c.company_number!,
        name: c.title!,
        country: 'uk' as const,
        address: c.address_snippet,
        companyType: c.company_type,
        status: c.company_status,
      }));
  } catch { return []; }
}

// ─── Multi-country sweep ────────────────────────────────────────────────────────

async function sweep(
  preset: typeof PRESETS[number],
  countries: Set<'dk' | 'no' | 'se' | 'de' | 'uk'>,
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<RegistryCompany[]> {
  const queries: Array<{ fn: (q: string) => Promise<RegistryCompany[]>; q: string }> = [];

  if (countries.has('dk')) {
    for (const term of preset.dk) {
      queries.push({ fn: searchCvr, q: term });
      for (const city of CITIES_DK.slice(0, 5)) {
        queries.push({ fn: searchCvr, q: `${term} ${city}` });
      }
    }
  }
  if (countries.has('no')) {
    for (const term of preset.no) {
      queries.push({ fn: searchBrreg, q: term });
      for (const city of CITIES_NO.slice(0, 5)) {
        queries.push({ fn: searchBrreg, q: `${term} ${city}` });
      }
    }
  }
  if (countries.has('se')) {
    for (const term of preset.se) {
      queries.push({ fn: q => searchOpenCorporates(q, 'se'), q: term });
      for (const city of CITIES_SE.slice(0, 3)) {
        queries.push({ fn: q => searchOpenCorporates(q, 'se'), q: `${term} ${city}` });
      }
    }
  }
  if (countries.has('de')) {
    for (const term of preset.de) {
      queries.push({ fn: q => searchOpenCorporates(q, 'de'), q: term });
      for (const city of CITIES_DE.slice(0, 3)) {
        queries.push({ fn: q => searchOpenCorporates(q, 'de'), q: `${term} ${city}` });
      }
    }
  }
  if (countries.has('uk')) {
    for (const term of preset.uk) {
      queries.push({ fn: searchCompaniesHouse, q: term });
      for (const city of CITIES_UK.slice(0, 4)) {
        queries.push({ fn: searchCompaniesHouse, q: `${term} ${city}` });
      }
    }
  }

  const seen = new Set<string>();
  const results: RegistryCompany[] = [];
  let done = 0;

  for (const { fn, q } of queries) {
    if (signal.aborted) break;
    try {
      const batch = await fn(q);
      for (const c of batch) {
        if (!seen.has(c.id)) { seen.add(c.id); results.push(c); }
      }
    } catch { /* skip */ }
    done++;
    onProgress(done, queries.length);
    // Rate-limit: max 1 req/s for cvrapi.dk; OpenCorporates kræver også lidt mellemrum
    if (!signal.aborted) await new Promise(r => setTimeout(r, 1100));
  }
  return results;
}

// ─── Scoring ────────────────────────────────────────────────────────────────────

function score(c: RegistryCompany) {
  let s = 0;
  if (c.email) s += 40;
  if (c.phone) s += 30;
  if (c.employees) s += 15;
  if (c.owner) s += 15;
  return s;
}

// ─── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ done, total, countries }: { done: number; total: number; countries: Set<string> }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="rounded-2xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Søger på tværs af {[...countries].map(c => COUNTRIES[c as keyof typeof COUNTRIES].flag).join(' ')}...
        </span>
        <span className="text-muted-foreground tabular-nums">{done} / {total}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        Industri × byer i {[...countries].map(c => COUNTRIES[c as keyof typeof COUNTRIES].label).join(', ')} — ingen API-nøgle nødvendig
      </p>
    </div>
  );
}

// ─── Company card ───────────────────────────────────────────────────────────────

function CompanyCard({
  company, selected, imported, onToggle,
}: {
  company: RegistryCompany; selected: boolean; imported: boolean; onToggle: () => void;
}) {
  const countryInfo = COUNTRIES[company.country];
  const s = score(company);
  return (
    <div
      onClick={imported ? undefined : onToggle}
      className={`rounded-2xl border p-4 transition-all cursor-pointer select-none ${
        imported
          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10 opacity-60'
          : selected
          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
          : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
      }`}
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
              {company.industry && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                  <Briefcase className="h-3 w-3 shrink-0" />{company.industry}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {s >= 70 && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${countryInfo.color}`}>
                {countryInfo.flag} {countryInfo.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {(company.address || company.city) && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {[company.address, [company.zipcode, company.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
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
            <span className="text-xs text-muted-foreground font-mono">
              {company.country.toUpperCase()} {company.vat}
            </span>
            {company.owner && (
              <span className="text-xs text-muted-foreground truncate ml-2">Ejer: {company.owner}</span>
            )}
            {company.companyType && (
              <Badge variant="outline" className="text-xs ml-2 shrink-0">{company.companyType}</Badge>
            )}
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

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function CvrProspectorPage() {
  const { toast } = useToast();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RegistryCompany[]>([]);
  const [sweeping, setSweeping] = useState(false);
  const [sweepProgress, setSweepProgress] = useState({ done: 0, total: 0 });
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [withEmailOnly, setWithEmailOnly] = useState(false);
  const [sortByScore, setSortByScore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Country toggles — DK + NO on by default; SE/DE/UK optional
  const [activeCountries, setActiveCountries] = useState<Set<'dk' | 'no' | 'se' | 'de' | 'uk'>>(
    new Set(['dk', 'no'])
  );

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleCountry = (c: 'dk' | 'no' | 'se' | 'de' | 'uk') => {
    setActiveCountries(prev => {
      if (prev.size === 1 && prev.has(c)) return prev; // keep at least one
      const n = new Set(prev);
      if (n.has(c)) n.delete(c); else n.add(c);
      return n;
    });
  };

  // Quick manual search — DK only (CVR)
  const quickSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearchError(null);
    setResults([]);
    setSelected(new Set());
    setActivePreset(null);
    setSweeping(true);
    setSweepProgress({ done: 0, total: 1 });
    try {
      const found = await searchCvr(q);
      setSweepProgress({ done: 1, total: 1 });
      if (found.length === 0) setSearchError('Ingen resultater — prøv et andet søgeord');
      setResults(found);
    } catch { setSearchError('Søgning mislykkedes'); }
    finally { setSweeping(false); }
  }, []);

  const runSweep = useCallback(async (preset: typeof PRESETS[number]) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setActivePreset(preset.label);
    setResults([]);
    setSelected(new Set());
    setSearchError(null);
    setSweeping(true);

    try {
      const found = await sweep(
        preset,
        activeCountries,
        (done, total) => setSweepProgress({ done, total }),
        ctrl.signal,
      );
      if (found.length === 0 && !ctrl.signal.aborted) setSearchError('Ingen resultater — prøv manuelt søgeord');
      setResults(found);
    } catch {
      if (!ctrl.signal.aborted) setSearchError('Søgning mislykkedes');
    } finally { setSweeping(false); }
  }, [activeCountries]);

  const stopSweep = () => { abortRef.current?.abort(); setSweeping(false); };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  // Derived
  const filtered = results
    .filter(c => !withEmailOnly || !!c.email)
    .filter(c => !imported.has(c.id));

  const sorted = sortByScore ? [...filtered].sort((a, b) => score(b) - score(a)) : filtered;
  const allResults = results.filter(c => !imported.has(c.id));
  const selectedNotImported = [...selected].filter(id => !imported.has(id));
  const withEmail = results.filter(c => c.email).length;
  const withPhone = results.filter(c => c.phone).length;
  const byCountry = (['dk', 'no', 'se', 'de', 'uk'] as const).map(cc => ({
    cc, count: results.filter(c => c.country === cc).length,
  }));

  // Export CSV
  const exportCsv = () => {
    const rows = [
      ['Navn', 'Land', 'CVR/Org.nr', 'Branche', 'Ansatte', 'Adresse', 'By', 'Postnr', 'Telefon', 'Email', 'Ejer', 'Virksomhedstype'],
      ...sorted.map(c => [
        c.name, COUNTRIES[c.country].label, c.vat, c.industry ?? '', c.employees ?? '',
        c.address ?? '', c.city ?? '', c.zipcode ?? '',
        c.phone ?? '', c.email ?? '', c.owner ?? '', c.companyType ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `registry-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Import to CRM
  const importLeads = async () => {
    const toImport = results.filter(c => selected.has(c.id) && !imported.has(c.id));
    if (!toImport.length) return;
    setImportStatus('importing');
    setImportProgress({ done: 0, total: toImport.length });
    const failed: string[] = [];
    for (const company of toImport) {
      try {
        await api.createLead({
          // Brug altid firmanavnet som lead-navn — ejere fra CVR er juridiske enheder, ikke kontaktpersoner
          name: company.name,
          phone: company.phone || '—',
          email: company.email,
          company: company.name,
          status: 'cold',
        });
        setImported(prev => new Set([...prev, company.id]));
        setSelected(prev => { const n = new Set(prev); n.delete(company.id); return n; });
      } catch { failed.push(company.name); }
      setImportProgress(p => ({ ...p, done: p.done + 1 }));
      await new Promise(r => setTimeout(r, 120));
    }
    setImportStatus('done');
    const ok = toImport.length - failed.length;
    toast({
      title: `${ok} leads importeret til CRM`,
      description: failed.length ? `${failed.length} fejlede` : 'Find dem under CRM → Leads',
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
            <h1 className="text-2xl font-semibold">Registry Prospector</h1>
            <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">100% gratis · ingen nøgler</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Officielle statsregistre: 🇩🇰 CVR · 🇳🇴 Brønnøysund · 🇸🇪 Bolagsverket · 🇩🇪 Handelsregister · 🇬🇧 Companies House
          </p>
        </div>
        {imported.size > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{imported.size}</p>
            <p className="text-xs text-muted-foreground">leads importeret</p>
          </div>
        )}
      </div>

      {/* Search + country toggles */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        {/* Country selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <Flag className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Lande:</span>
          {(['dk', 'no', 'se', 'de', 'uk'] as const).map(cc => (
            <button
              key={cc}
              onClick={() => toggleCountry(cc)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${
                activeCountries.has(cc)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              {COUNTRIES[cc].flag} {COUNTRIES[cc].label}
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-1">
            ({[...activeCountries].length} valgt)
          </span>
        </div>

        {/* Search row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setActivePreset(null); }}
              onKeyDown={e => e.key === 'Enter' && quickSearch(query)}
              placeholder="Manuel søgning på CVR (dansk)..."
              className="pl-9"
            />
            {query && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setQuery(''); setResults([]); }}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button variant="outline" onClick={() => quickSearch(query)} disabled={sweeping || !query.trim()}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Preset grid */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-2.5 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Vælg branche — søger i alle valgte lande automatisk
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
                {activePreset === preset.label && sweeping && <Loader2 className="h-3 w-3 animate-spin ml-auto shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="rounded-xl bg-muted/50 px-4 py-2.5 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            DK + NO: direkte fra statsregister. SE + DE: via OpenCorporates gratis tier (kun navn + adresse). UK: proxy via backend (kræver <code className="bg-muted px-1 rounded">COMPANIES_HOUSE_API_KEY</code>).
          </p>
        </div>
      </div>

      {/* Progress */}
      {sweeping && (
        <div className="space-y-3">
          <ProgressBar done={sweepProgress.done} total={sweepProgress.total} countries={activeCountries} />
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={stopSweep}>
              <X className="h-3.5 w-3.5 mr-1.5" />Stop (vis delvise resultater)
            </Button>
          </div>
        </div>
      )}

      {/* Results */}
      {(results.length > 0 || searchError) && !sweeping && (
        <div className="space-y-4">
          {/* Stats */}
          {results.length > 0 && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex gap-4">
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
              </div>
              {/* Per-country breakdown */}
              <div className="flex gap-2">
                {byCountry.filter(x => x.count > 0).map(x => (
                  <span key={x.cc} className={`px-2 py-1 rounded-lg text-xs font-medium ${COUNTRIES[x.cc].color}`}>
                    {COUNTRIES[x.cc].flag} {x.count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => setShowFilters(v => !v)}>
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                Filter
                {(withEmailOnly) && <Badge variant="default" className="ml-1.5 h-4 px-1 text-xs">1</Badge>}
              </Button>
              {results.length > 0 && (
                <>
                  <button className="text-xs text-primary hover:underline" onClick={() => setSelected(new Set(allResults.map(c => c.id)))}>
                    Vælg alle ({allResults.length})
                  </button>
                  <span className="text-muted-foreground text-xs">·</span>
                  <button className="text-xs text-muted-foreground hover:underline" onClick={() => setSelected(new Set())}>
                    Fravælg
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {results.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />CSV
                </Button>
              )}
              {selectedNotImported.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => void importLeads()}
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

          {/* Filters */}
          {showFilters && (
            <div className="rounded-xl border bg-muted/30 p-4 flex flex-wrap gap-4">
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
              <p className="text-xs text-muted-foreground self-end ml-auto">
                Viser {sorted.length} af {results.length} resultater
              </p>
            </div>
          )}

          {searchError && (
            <div className="rounded-2xl border border-dashed p-8 text-center space-y-2">
              <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">{searchError}</p>
            </div>
          )}

          {importStatus === 'done' && (
            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 px-4 py-3 flex items-center gap-3">
              <CheckSquare className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                Leads importeret — find dem under CRM → Leads
              </p>
            </div>
          )}

          {sorted.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {sorted.map(company => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  selected={selected.has(company.id)}
                  imported={imported.has(company.id)}
                  onToggle={() => toggleSelect(company.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && !sweeping && !searchError && (
        <div className="rounded-2xl border border-dashed p-12 flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary/60" />
          </div>
          <div className="max-w-sm">
            <p className="font-semibold text-lg">Find virksomheder i Norden, DACH og UK</p>
            <p className="text-sm text-muted-foreground mt-1">
              Officielle registre — gratis for alle. Vælg lande og klik en branche ovenfor.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {(['dk', 'no', 'se', 'de', 'uk'] as const).map(cc => (
              <span key={cc} className={`px-3 py-1.5 rounded-xl text-sm font-medium ${COUNTRIES[cc].color}`}>
                {COUNTRIES[cc].flag} {COUNTRIES[cc].label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
