/**
 * Cold Caller — multi-tenant power-dialler
 * ──────────────────────────────────────────────────────────────────────────
 * Multi-tenancy is built-in:
 *   • Leads    — fetched via useLeads() → scoped to company_id by Railway API
 *   • Token    — fetched via api.getTwilioVoiceToken() → company credentials
 *                with JWT-aware fallback to twilio-server
 *   • Call log — via api.logCall() → scoped to company_id by Railway API
 *   • Device   — Twilio.Device initialised with company-specific token
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Device, type Call } from '@twilio/voice-sdk';
import { useI18n } from '@/lib/i18n';
import { api, type CallOutcome } from '@/lib/api';
import { useLeads } from '@/hooks/api/useLeads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  Phone, PhoneOff, PhoneIncoming, Mic, MicOff, RefreshCw,
  Play, Square, SkipForward, CheckCircle, XCircle, Voicemail,
  PhoneMissed, Clock, Users, TrendingUp, ChevronRight, ChevronDown,
  AlertCircle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type DeviceStatus = 'offline' | 'connecting' | 'ready' | 'busy' | 'error';
type SessionStatus = 'idle' | 'running' | 'paused' | 'done';
type LeadStatus = 'pending' | 'calling' | 'called' | 'skipped';

interface QueuedLead {
  id: string;
  name: string;
  phone: string;
  company?: string;
  email?: string;
  status: LeadStatus;
  outcome?: CallOutcome;
  notes?: string;
  duration?: number;
}

interface SessionStats {
  total:    number;
  called:   number;
  answered: number;
  noAnswer: number;
  skipped:  number;
  duration: number;   // total seconds in call
}

const TWILIO_API = import.meta.env.VITE_TWILIO_SERVER_URL ?? '/api/twilio';

// ── Outcome config ────────────────────────────────────────────────────────────

const OUTCOMES: { value: CallOutcome; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'answered',  label: 'Besvaret',      icon: <CheckCircle  className="h-4 w-4" />, color: 'text-green-600'  },
  { value: 'no_answer', label: 'Intet svar',    icon: <PhoneMissed  className="h-4 w-4" />, color: 'text-yellow-600' },
  { value: 'voicemail', label: 'Telefonsvarer',  icon: <Voicemail    className="h-4 w-4" />, color: 'text-blue-600'   },
  { value: 'busy',      label: 'Optaget',        icon: <XCircle      className="h-4 w-4" />, color: 'text-orange-600' },
  { value: 'failed',    label: 'Fejlede',        icon: <AlertCircle  className="h-4 w-4" />, color: 'text-red-600'    },
];

// ── Helper ────────────────────────────────────────────────────────────────────

function fmtDuration(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
function fmtTimer(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ColdCallerPage() {
  const { t } = useI18n();
  const { toast } = useToast();

  // ── Device refs ───────────────────────────────────────────────────────────
  const deviceRef     = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const callTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Device state ──────────────────────────────────────────────────────────
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>('offline');
  const [identity,     setIdentity]     = useState('');
  const [isMuted,      setIsMuted]      = useState(false);
  const [callSeconds,  setCallSeconds]  = useState(0);
  const [isInCall,     setIsInCall]     = useState(false);
  const [isRinging,    setIsRinging]    = useState(false);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);

  // ── Session state ─────────────────────────────────────────────────────────
  const [sessionStatus,  setSessionStatus]  = useState<SessionStatus>('idle');
  const [queue,          setQueue]          = useState<QueuedLead[]>([]);
  const [currentIndex,   setCurrentIndex]   = useState(0);
  const [showOutcome,    setShowOutcome]     = useState(false);
  const [outcomeValue,   setOutcomeValue]    = useState<CallOutcome>('answered');
  const [outcomeNotes,   setOutcomeNotes]    = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [stats,          setStats]          = useState<SessionStats>({
    total: 0, called: 0, answered: 0, noAnswer: 0, skipped: 0, duration: 0,
  });

  // ── Lead filter state ─────────────────────────────────────────────────────
  const [leadFilter, setLeadFilter] = useState('');

  // ── Load leads ────────────────────────────────────────────────────────────
  const leadsQ = useLeads({ status: 'cold' });
  type RawLead = { id: string; name: string; phone: string; company?: string; email?: string; status: string };
  const availableLeads = useMemo((): QueuedLead[] => {
    const raw = (leadsQ.data as { data?: unknown[] } | undefined)?.data ?? [];
    return (raw as Record<string, unknown>[])
      .map(r => ({
        id:      String(r.id ?? ''),
        name:    String(r.name ?? ''),
        phone:   String(r.phone ?? ''),
        company: r.company != null ? String(r.company) : undefined,
        email:   r.email   != null ? String(r.email)   : undefined,
        status:  'pending' as LeadStatus,
      }))
      .filter(l => !!l.phone);
  }, [leadsQ.data]);

  const filteredLeads = useMemo(() => {
    if (!leadFilter) return availableLeads;
    const q = leadFilter.toLowerCase();
    return availableLeads.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      (l.company ?? '').toLowerCase().includes(q),
    );
  }, [availableLeads, leadFilter]);

  const currentLead = queue[currentIndex] ?? null;

  // ── Token fetch (multi-tenant) ────────────────────────────────────────────
  const fetchToken = useCallback(async (): Promise<{ token: string; identity: string }> => {
    // Primary: Railway API (uses company's own Twilio credentials)
    try {
      const data = await api.getTwilioVoiceToken(identity || undefined);
      return { token: data.token, identity: data.identity };
    } catch {
      // Fallback: local twilio-server (reads .env or fetches via JWT)
    }

    const jwt = api.getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

    const res = await fetch(`${TWILIO_API}/token`, { headers });
    if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
    return res.json() as Promise<{ token: string; identity: string }>;
  }, [identity]);

  // ── Wire Device event handlers ────────────────────────────────────────────
  const wireCall = useCallback((call: Call, direction: 'outgoing' | 'incoming') => {
    activeCallRef.current = call;
    setIsRinging(direction === 'outgoing');
    setCallSeconds(0);

    call.on('accept', () => {
      setIsInCall(true);
      setIsRinging(false);
      callTimerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000);
    });

    call.on('disconnect', () => {
      const duration = callSeconds;
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
      setIsInCall(false);
      setIsRinging(false);
      setIncomingCall(null);
      setIsMuted(false);
      activeCallRef.current = null;
      setDeviceStatus('ready');
      // Show outcome form after call ends
      if (direction === 'outgoing' && sessionStatus === 'running') {
        setOutcomeValue('answered');
        setOutcomeNotes('');
        setShowOutcome(true);
      }
      // Update queue item duration
      if (currentLead) {
        setQueue(q => q.map((lead, i) =>
          i === currentIndex ? { ...lead, status: 'calling' as LeadStatus, duration } : lead,
        ));
      }
    });

    call.on('cancel', () => {
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
      setIsInCall(false);
      setIsRinging(false);
      setIncomingCall(null);
      activeCallRef.current = null;
      setDeviceStatus('ready');
    });

    call.on('error', (err: Error) => {
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
      setIsInCall(false);
      setIsRinging(false);
      setDeviceStatus('ready');
      toast({ title: 'Opkaldsfejl', description: err.message, variant: 'destructive' });
    });

    call.on('mute', (m: boolean) => setIsMuted(m));
  }, [callSeconds, currentIndex, currentLead, sessionStatus, toast]);

  // ── Init Device ───────────────────────────────────────────────────────────
  const initDevice = useCallback(async () => {
    setDeviceStatus('connecting');
    try {
      const { token, identity: id } = await fetchToken();
      setIdentity(id);

      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch { /* ignore */ }
        deviceRef.current = null;
      }

      const device = new Device(token, {
        // @ts-expect-error typings lag
        codecPreferences: ['opus', 'pcmu'],
        enableImprovedSignalingErrorPrecision: true,
        logLevel: import.meta.env.DEV ? 1 : 0,
      });

      device.on('registered',   () => { setDeviceStatus('ready'); });
      device.on('unregistered', () => { setDeviceStatus('offline'); });
      device.on('error',        (err: { message: string }) => {
        setDeviceStatus('error');
        console.error('[ColdCaller] Device error:', err);
      });

      device.on('incoming', (call: Call) => {
        if (activeCallRef.current) { call.reject(); return; }
        setIncomingCall(call);
        setDeviceStatus('busy');
        call.on('cancel', () => { setIncomingCall(null); setDeviceStatus('ready'); });
      });

      device.on('tokenWillExpire', async () => {
        try {
          const { token: t } = await fetchToken();
          device.updateToken(t);
        } catch { /* ignore — re-register on next user action */ }
      });

      await device.register();
      deviceRef.current = device;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeviceStatus('error');
      toast({ title: 'Kunne ikke starte softphone', description: msg, variant: 'destructive' });
    }
  }, [fetchToken, toast]);

  useEffect(() => {
    void initDevice();
    return () => {
      if (callTimerRef.current)    clearInterval(callTimerRef.current);
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      if (deviceRef.current) try { deviceRef.current.destroy(); } catch { /* ignore */ }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session controls ──────────────────────────────────────────────────────

  const startSession = useCallback(() => {
    if (filteredLeads.length === 0) {
      toast({ title: 'Ingen leads i køen', variant: 'destructive' }); return;
    }
    const q = filteredLeads.map(l => ({ ...l, status: 'pending' as LeadStatus }));
    setQueue(q);
    setCurrentIndex(0);
    setSessionStatus('running');
    setSessionSeconds(0);
    setStats({ total: q.length, called: 0, answered: 0, noAnswer: 0, skipped: 0, duration: 0 });
    setShowOutcome(false);
    sessionTimerRef.current = setInterval(() => setSessionSeconds(s => s + 1), 1000);
  }, [filteredLeads, toast]);

  const stopSession = useCallback(() => {
    if (sessionTimerRef.current) { clearInterval(sessionTimerRef.current); sessionTimerRef.current = null; }
    if (activeCallRef.current) activeCallRef.current.disconnect();
    setSessionStatus('idle');
    setShowOutcome(false);
  }, []);

  // ── Dial current lead ─────────────────────────────────────────────────────

  const dialCurrent = useCallback(async () => {
    if (!currentLead || deviceStatus !== 'ready') return;
    setDeviceStatus('busy');
    setQueue(q => q.map((l, i) => i === currentIndex ? { ...l, status: 'calling' } : l));
    try {
      const call = await deviceRef.current!.connect({ params: { To: currentLead.phone } });
      wireCall(call, 'outgoing');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Opkald fejlede', description: msg, variant: 'destructive' });
      setDeviceStatus('ready');
      setQueue(q => q.map((l, i) => i === currentIndex ? { ...l, status: 'pending' } : l));
    }
  }, [currentLead, currentIndex, deviceStatus, wireCall, toast]);

  const hangup = useCallback(() => {
    if (activeCallRef.current) activeCallRef.current.disconnect();
  }, []);

  // ── Save outcome & advance ────────────────────────────────────────────────

  const saveOutcomeAndAdvance = useCallback(async () => {
    if (!currentLead) return;
    const dur = currentLead.duration ?? 0;

    // Log call to Railway API (scoped to company by JWT automatically)
    try {
      await api.logCall({
        lead_id:          currentLead.id,
        to_number:        currentLead.phone,
        outcome:          outcomeValue,
        duration_seconds: dur || undefined,
        notes:            outcomeNotes || undefined,
      });
    } catch {
      // Non-fatal — log locally anyway
    }

    // Update queue item
    setQueue(q => q.map((l, i) => i === currentIndex
      ? { ...l, status: 'called', outcome: outcomeValue, notes: outcomeNotes }
      : l,
    ));

    // Update stats
    setStats(s => ({
      ...s,
      called:   s.called + 1,
      answered: outcomeValue === 'answered' ? s.answered + 1 : s.answered,
      noAnswer: (outcomeValue === 'no_answer' || outcomeValue === 'voicemail') ? s.noAnswer + 1 : s.noAnswer,
      duration: s.duration + dur,
    }));

    setShowOutcome(false);
    advanceQueue();
  }, [currentLead, currentIndex, outcomeValue, outcomeNotes]);

  const skipLead = useCallback(() => {
    if (!currentLead) return;
    setQueue(q => q.map((l, i) => i === currentIndex ? { ...l, status: 'skipped' } : l));
    setStats(s => ({ ...s, skipped: s.skipped + 1 }));
    advanceQueue();
  }, [currentLead, currentIndex]);

  function advanceQueue() {
    setQueue(prev => {
      const next = prev.findIndex((l, i) => i > currentIndex && l.status === 'pending');
      if (next === -1) {
        // All leads done
        setSessionStatus('done');
        if (sessionTimerRef.current) { clearInterval(sessionTimerRef.current); sessionTimerRef.current = null; }
        toast({ title: '✅ Session afsluttet', description: 'Alle leads er gennemringet.' });
      } else {
        setCurrentIndex(next);
      }
      return prev;
    });
  }

  // ── Incoming call handlers ────────────────────────────────────────────────

  const acceptIncoming = () => {
    if (!incomingCall) return;
    incomingCall.accept();
    wireCall(incomingCall, 'incoming');
    setIncomingCall(null);
  };
  const rejectIncoming = () => {
    incomingCall?.reject();
    setIncomingCall(null);
    setDeviceStatus('ready');
  };

  // ── Computed ──────────────────────────────────────────────────────────────

  const canDial     = deviceStatus === 'ready' && !isInCall && !isRinging && sessionStatus === 'running';
  const progress    = stats.total > 0 ? Math.round((stats.called + stats.skipped) / stats.total * 100) : 0;

  // Status dot
  const dotColor = {
    offline:    'bg-gray-400',
    connecting: 'bg-yellow-400',
    ready:      'bg-green-500',
    busy:       'bg-blue-500',
    error:      'bg-red-500',
  }[deviceStatus];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-5xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Phone className="h-6 w-6 text-green-600" />
            Cold Caller
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Power-dialler — ring leads igennem én efter én
          </p>
        </div>

        {/* Device status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className={`h-2.5 w-2.5 rounded-full ${dotColor} ${deviceStatus === 'connecting' ? 'animate-pulse' : ''}`} />
            <span className="font-medium">{identity ? `${identity}` : deviceStatus}</span>
          </div>
          <Button variant="outline" size="sm" onClick={initDevice}
            disabled={deviceStatus === 'connecting' || isInCall} className="gap-1.5 h-8">
            <RefreshCw className={`h-3 w-3 ${deviceStatus === 'connecting' ? 'animate-spin' : ''}`} />
            Genopret
          </Button>
        </div>
      </div>

      {/* ── Incoming call overlay ───────────────────────────────────────────── */}
      {incomingCall && (
        <Card className="p-4 border-2 border-green-500 bg-green-50 dark:bg-green-950/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
                <PhoneIncoming className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-green-700 dark:text-green-300">Indgående opkald</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {(incomingCall.parameters.From as string | undefined) ?? '?'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={acceptIncoming}>
                <Phone className="h-3.5 w-3.5" />Besvar
              </Button>
              <Button size="sm" variant="destructive" onClick={rejectIncoming} className="gap-1">
                <PhoneOff className="h-3.5 w-3.5" />Afvis
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Session stats bar ───────────────────────────────────────────────── */}
      {sessionStatus !== 'idle' && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Stat pills */}
            <div className="flex items-center gap-3 flex-wrap">
              <StatPill icon={<Users className="h-3.5 w-3.5" />}   label="Total"     value={stats.total}    color="text-foreground"    />
              <StatPill icon={<Phone className="h-3.5 w-3.5" />}   label="Kaldt"     value={stats.called}   color="text-blue-600"      />
              <StatPill icon={<CheckCircle className="h-3.5 w-3.5" />} label="Svar"  value={stats.answered} color="text-green-600"     />
              <StatPill icon={<PhoneMissed className="h-3.5 w-3.5" />} label="Intet" value={stats.noAnswer} color="text-yellow-600"    />
              <StatPill icon={<SkipForward className="h-3.5 w-3.5" />} label="Skip"  value={stats.skipped}  color="text-muted-foreground" />
              <StatPill icon={<Clock className="h-3.5 w-3.5" />}   label="Session"   value={fmtTimer(sessionSeconds)} color="text-purple-600" />
            </div>
            {/* Progress + stop */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-28 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
              {sessionStatus === 'done' ? (
                <Button size="sm" variant="outline" onClick={stopSession} className="gap-1">
                  <Square className="h-3 w-3" />Afslut
                </Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={stopSession} className="gap-1">
                  <Square className="h-3 w-3" />Stop
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-5">

        {/* ── Left: lead queue ───────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Opkaldskø
                <Badge variant="secondary" className="ml-1">{availableLeads.length}</Badge>
              </div>
              {sessionStatus === 'idle' && (
                <Button size="sm" onClick={startSession}
                  disabled={deviceStatus !== 'ready' || filteredLeads.length === 0}
                  className="bg-green-600 hover:bg-green-700 gap-1.5 h-7">
                  <Play className="h-3 w-3" />Start session
                </Button>
              )}
            </div>

            <Input
              placeholder="Søg leads..."
              value={leadFilter}
              onChange={e => setLeadFilter(e.target.value)}
              className="h-8 text-sm"
            />

            <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
              {filteredLeads.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {leadsQ.isLoading ? 'Indlæser...' : 'Ingen kolde leads med telefonnummer'}
                </p>
              ) : (
                (sessionStatus === 'idle' ? filteredLeads : queue).map((lead, idx) => {
                  const isCurrent = sessionStatus !== 'idle' && idx === currentIndex;
                  const statusIcon =
                    lead.status === 'called'   ? <CheckCircle  className="h-3.5 w-3.5 text-green-500  shrink-0" /> :
                    lead.status === 'skipped'  ? <SkipForward  className="h-3.5 w-3.5 text-gray-400   shrink-0" /> :
                    lead.status === 'calling'  ? <Phone        className="h-3.5 w-3.5 text-blue-500 animate-pulse shrink-0" /> :
                                                 <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
                  return (
                    <div key={lead.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                      isCurrent ? 'bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700' : 'hover:bg-muted/40'
                    }`}>
                      {statusIcon}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isCurrent ? 'text-green-700 dark:text-green-300' : ''}`}>
                          {lead.name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">{lead.phone}</p>
                      </div>
                      {lead.outcome && (
                        <Badge variant="outline" className="text-xs h-5 shrink-0">
                          {OUTCOMES.find(o => o.value === lead.outcome)?.label ?? lead.outcome}
                        </Badge>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* ── Right: active dialler ──────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">

          {sessionStatus === 'idle' && (
            <Card className="p-8 text-center space-y-4 text-muted-foreground">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Phone className="h-8 w-8" />
              </div>
              <div>
                <p className="text-sm font-medium">Ingen aktiv session</p>
                <p className="text-xs mt-1">
                  {availableLeads.length > 0
                    ? `${availableLeads.length} kolde leads klar — klik "Start session"`
                    : 'Opret kolde leads med telefonnumre i CRM for at starte'}
                </p>
              </div>
              {deviceStatus === 'ready' && availableLeads.length > 0 && (
                <Button onClick={startSession} className="bg-green-600 hover:bg-green-700 gap-1.5">
                  <Play className="h-4 w-4" />Start Cold Call Session
                </Button>
              )}
            </Card>
          )}

          {sessionStatus === 'done' && (
            <Card className="p-8 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="text-base font-semibold">Session afsluttet!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {stats.called} kaldt · {stats.answered} svarede · {stats.skipped} skippede
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total samtaletid: {fmtDuration(stats.duration)} · Session: {fmtTimer(sessionSeconds)}
                </p>
              </div>
              <Button onClick={stopSession} variant="outline">Ny session</Button>
            </Card>
          )}

          {(sessionStatus === 'running' || sessionStatus === 'paused') && currentLead && (
            <>
              {/* Current lead card */}
              <Card className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">
                      Lead {currentIndex + 1} / {queue.length}
                    </p>
                    <h2 className="text-xl font-bold">{currentLead.name}</h2>
                    {currentLead.company && (
                      <p className="text-sm text-muted-foreground">{currentLead.company}</p>
                    )}
                    <p className="text-lg font-mono mt-1">{currentLead.phone}</p>
                  </div>
                  {/* In-call timer */}
                  {isInCall && (
                    <Badge className="bg-blue-500 text-white tabular-nums text-base px-3 py-1">
                      {fmtTimer(callSeconds)}
                    </Badge>
                  )}
                  {isRinging && (
                    <Badge className="bg-yellow-500 text-white animate-pulse">Ringer...</Badge>
                  )}
                </div>

                {/* Dial / Hangup / Skip */}
                <div className="flex gap-2 flex-wrap">
                  {!isInCall && !isRinging ? (
                    <>
                      <Button onClick={dialCurrent} disabled={!canDial}
                        className="bg-green-600 hover:bg-green-700 gap-1.5 flex-1">
                        <Phone className="h-4 w-4" />Ring op
                      </Button>
                      {!showOutcome && (
                        <Button variant="outline" onClick={skipLead} className="gap-1.5">
                          <SkipForward className="h-4 w-4" />Skip
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button variant="destructive" onClick={hangup} className="gap-1.5 flex-1">
                        <PhoneOff className="h-4 w-4" />Læg på
                      </Button>
                      <Button variant={isMuted ? 'destructive' : 'outline'} size="sm"
                        onClick={() => activeCallRef.current?.mute(!isMuted)} className="gap-1">
                        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </Button>
                    </>
                  )}
                </div>
              </Card>

              {/* Outcome form — appears after call */}
              {showOutcome && (
                <Card className="p-5 space-y-4 border-2 border-primary/30">
                  <div className="text-sm font-semibold">Hvad skete der med opkaldet?</div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {OUTCOMES.map(o => (
                      <button
                        key={o.value}
                        onClick={() => setOutcomeValue(o.value)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors text-left ${
                          outcomeValue === o.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <span className={o.color}>{o.icon}</span>
                        {o.label}
                      </button>
                    ))}
                  </div>

                  <Textarea
                    placeholder="Noter (valgfrit)..."
                    value={outcomeNotes}
                    onChange={e => setOutcomeNotes(e.target.value)}
                    className="h-20 text-sm resize-none"
                  />

                  <div className="flex gap-2">
                    <Button onClick={saveOutcomeAndAdvance} className="flex-1 gap-1.5">
                      <TrendingUp className="h-4 w-4" />Gem & næste lead
                    </Button>
                    <Button variant="outline" onClick={skipLead} className="gap-1">
                      <SkipForward className="h-4 w-4" />Spring over
                    </Button>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Error / setup card */}
          {deviceStatus === 'error' && (
            <Card className="p-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-1.5">
                ⚠️ Twilio ikke forbundet
              </p>
              <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
                <li>Gå til <strong>Indstillinger → Twilio Integration</strong> og gem dine credentials</li>
                <li>Eller: Kør <code className="font-mono">twilio-server</code> lokalt med gyldige env vars</li>
                <li>Tillad mikrofon-adgang i browseren</li>
                <li>Klik <strong>Genopret</strong> ovenfor</li>
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number | string; color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={color}>{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className={`font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
