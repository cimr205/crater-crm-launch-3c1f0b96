import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, XCircle, Building2 } from 'lucide-react';

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

interface Props {
  value: string;
  onChange: (v: string) => void;
  onResult: (data: CvrData) => void;
  placeholder?: string;
  className?: string;
}

/**
 * CVR-søgefelt med automatisk opslag på cvrapi.dk (Virk.dk-data).
 * Starter opslag så snart 8 cifre er indtastet (debounced 400 ms).
 * Kalder onResult() med virksomhedsdata ved succes.
 */
export default function CvrSearchInput({
  value,
  onChange,
  onResult,
  placeholder = 'CVR-nummer (8 cifre)',
  className,
}: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'found' | 'error'>('idle');
  const [foundName, setFoundName] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clean = value.replace(/\D/g, '');

    if (clean.length < 8) {
      setStatus('idle');
      setFoundName('');
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setStatus('loading');
      try {
        const res = await fetch(
          `https://cvrapi.dk/api?vat=${clean}&country=dk`,
          { headers: { 'User-Agent': 'CraterCRM/1.0' } }
        );
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
    <div className="space-y-1">
      <div className="relative">
        <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className={`pl-8 pr-8 font-mono tracking-wider ${className ?? ''}`}
          placeholder={placeholder}
          value={value}
          inputMode="numeric"
          maxLength={8}
          onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
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
          <span><strong>{foundName}</strong> — oplysninger udfyldt automatisk fra Virk.dk</span>
        </p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <XCircle className="h-3 w-3 shrink-0" />
          CVR-nummer ikke fundet i Virk.dk — udfyld manuelt
        </p>
      )}
    </div>
  );
}
