import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, XCircle, Building2 } from 'lucide-react';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface CvrData {
  vat: string;
  name: string;
  address: string;
  zipcode: string;
  city: string;
  phone?: string;
  email?: string;
  owners?: Array<{ name: string }>;
}

export interface VatData {
  name: string;
  address: string;
  vat_number: string;
  country_code: string;
}

// ─── Countries supported by vatcomply.com ────────────────────────────────────
// EU-27 + UK + NO + CH (post-Brexit UK VAT works via HMRC integration)

const VAT_LOOKUP_COUNTRIES = new Set([
  'AT','BE','BG','CY','CZ','DE','EE','ES','FI','FR','GR','HR','HU',
  'IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
  'GB','NO','CH',
]);

export function supportsVatLookup(countryCode: string) {
  return VAT_LOOKUP_COUNTRIES.has(countryCode.toUpperCase());
}

// ─── CvrSearchInput — Danish CVR via Virk.dk ─────────────────────────────────

interface CvrProps {
  value: string;
  onChange: (v: string) => void;
  onResult: (data: CvrData) => void;
  placeholder?: string;
  className?: string;
}

/**
 * CVR-søgefelt med automatisk opslag på cvrapi.dk (Virk.dk-data).
 * Trigger: 8 cifre → auto-fetch (debounced 400 ms).
 */
export default function CvrSearchInput({
  value, onChange, onResult,
  placeholder = 'CVR-nummer (8 cifre)',
  className,
}: CvrProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'found' | 'error'>('idle');
  const [foundName, setFoundName] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clean = value.replace(/\D/g, '');
    if (clean.length < 8) { setStatus('idle'); setFoundName(''); return; }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus('loading');
      try {
        const res = await fetch(`https://cvrapi.dk/api?vat=${clean}&country=dk`, {
          headers: { 'User-Agent': 'CraterCRM/1.0' },
        });
        const data: CvrData & { error?: string } = await res.json();
        if (!res.ok || data.error) throw new Error(data.error ?? 'Ikke fundet');
        setStatus('found');
        setFoundName(data.name);
        onResult(data);
      } catch {
        setStatus('error');
        setFoundName('');
      }
    }, 400);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <StatusInput
      value={value}
      onChange={v => onChange(v.replace(/\D/g, '').slice(0, 8))}
      status={status}
      foundName={foundName}
      placeholder={placeholder}
      className={className}
      inputMode="numeric"
      maxLength={8}
      successSource="Virk.dk"
      errorMsg="CVR-nummer ikke fundet i Virk.dk — udfyld manuelt"
    />
  );
}

// ─── VatSearchInput — EU/UK/NO/CH VAT via vatcomply.com ──────────────────────

interface VatProps {
  countryCode: string; // 2-letter ISO, e.g. "DE", "FR", "GB"
  value: string;       // just the number part, without country prefix
  onChange: (v: string) => void;
  onResult: (data: VatData) => void;
  className?: string;
}

/**
 * EU/UK/NO/CH VAT-søgefelt via vatcomply.com (officiel EU VIES-data + HMRC).
 * Trigger: gyldig VAT-numre-længde for det valgte land → auto-fetch.
 * Viser countryCode-badge + inputfelt for nummerdelen.
 *
 * Understøttede lande: EU-27, GB, NO, CH.
 * For øvrige lande (US, CA, AU osv.) vises en note om manuel udfyldelse.
 */
export function VatSearchInput({ countryCode, value, onChange, onResult, className }: VatProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'found' | 'error'>('idle');
  const [foundName, setFoundName] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cc = countryCode.toUpperCase();

  // Reset when country changes
  useEffect(() => {
    setStatus('idle');
    setFoundName('');
  }, [cc]);

  useEffect(() => {
    if (!supportsVatLookup(cc)) return;
    // Minimum useful length: 4+ chars (shortest EU VAT numbers are ~7 with prefix)
    if (value.replace(/[\s-]/g, '').length < 4) {
      setStatus('idle');
      setFoundName('');
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus('loading');
      const fullVat = `${cc}${value.replace(/[\s-]/g, '')}`;
      try {
        const res = await fetch(`https://api.vatcomply.com/vat?vat_number=${encodeURIComponent(fullVat)}`);
        const data: VatData & { valid?: boolean; detail?: string } = await res.json();
        if (!res.ok || data.valid === false || !data.name) throw new Error(data.detail ?? 'Ikke fundet');
        setStatus('found');
        setFoundName(data.name);
        onResult(data);
      } catch {
        setStatus('error');
        setFoundName('');
      }
    }, 500);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, cc]);

  if (!supportsVatLookup(cc)) {
    return (
      <div className="space-y-1">
        <div className="relative">
          <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className={`pl-8 font-mono tracking-wider ${className ?? ''}`}
            placeholder="VAT / skattenummer (manuelt)"
            value={value}
            onChange={e => onChange(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Automatisk opslag understøttes ikke for {cc} — udfyld manuelt.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="relative flex items-center">
        {/* Country prefix badge */}
        <span className="absolute left-2.5 flex items-center gap-1 text-xs font-bold text-muted-foreground pointer-events-none select-none bg-muted/60 rounded px-1.5 py-0.5">
          {cc}
        </span>
        <Input
          className={`pl-12 pr-8 font-mono tracking-wider ${className ?? ''}`}
          placeholder="VAT-nummer — auto-udfyld fra EU register"
          value={value}
          onChange={e => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        />
        <div className="absolute right-2.5 pointer-events-none">
          {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {status === 'found'   && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {status === 'error'   && <XCircle className="h-4 w-4 text-red-500" />}
        </div>
      </div>

      {status === 'found' && foundName && (
        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span><strong>{foundName}</strong> — udfyldt automatisk fra EU VAT-register</span>
        </p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <XCircle className="h-3 w-3 shrink-0" />
          VAT-nummer ikke fundet — tjek nummeret eller udfyld manuelt
        </p>
      )}
    </div>
  );
}

// ─── Shared status input (internal) ──────────────────────────────────────────

function StatusInput({
  value, onChange, status, foundName, placeholder, className,
  inputMode, maxLength, successSource, errorMsg,
}: {
  value: string;
  onChange: (v: string) => void;
  status: 'idle' | 'loading' | 'found' | 'error';
  foundName: string;
  placeholder: string;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
  successSource: string;
  errorMsg: string;
}) {
  return (
    <div className="space-y-1">
      <div className="relative">
        <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className={`pl-8 pr-8 font-mono tracking-wider ${className ?? ''}`}
          placeholder={placeholder}
          value={value}
          inputMode={inputMode}
          maxLength={maxLength}
          onChange={e => onChange(e.target.value)}
        />
        <div className="absolute right-2.5 top-2.5 pointer-events-none">
          {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {status === 'found'   && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {status === 'error'   && <XCircle className="h-4 w-4 text-red-500" />}
        </div>
      </div>
      {status === 'found' && foundName && (
        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span><strong>{foundName}</strong> — oplysninger udfyldt automatisk fra {successSource}</span>
        </p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <XCircle className="h-3 w-3 shrink-0" />
          {errorMsg}
        </p>
      )}
    </div>
  );
}
