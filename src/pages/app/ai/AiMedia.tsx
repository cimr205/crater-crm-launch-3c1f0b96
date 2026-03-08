import { useCallback, useEffect, useRef, useState } from 'react';
import { api, AiGeneration } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Sparkles, Image as ImageIcon, Video, History, Loader2, Download,
  Trash2, RefreshCw, Clock, CheckCircle2, XCircle, AlertCircle,
  Play, Wand2,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const IMAGE_STYLES = [
  { value: 'realistic',    label: 'Realistisk fotografi' },
  { value: 'illustrated',  label: 'Illustreret / tegneserie' },
  { value: 'minimalist',   label: 'Minimalistisk' },
  { value: 'corporate',    label: 'Corporate / professionel' },
  { value: 'cinematic',    label: 'Cinematic / dramatisk' },
];

const VIDEO_STYLES = [
  { value: 'realistic',  label: 'Realistisk' },
  { value: 'animated',   label: 'Animeret' },
  { value: 'cinematic',  label: 'Cinematic' },
];

const ASPECT_RATIOS = [
  { value: '1:1',  label: '1:1 — Kvadrat (Instagram)' },
  { value: '16:9', label: '16:9 — Bredskærm (YouTube)' },
  { value: '9:16', label: '9:16 — Portræt (Stories / Reels)' },
  { value: '4:5',  label: '4:5 — Portræt (Feed)' },
];

const VIDEO_DURATIONS = [
  { value: 5,  label: '5 sekunder' },
  { value: 10, label: '10 sekunder' },
  { value: 15, label: '15 sekunder' },
];

const POLL_INTERVAL = 3_000; // 3 seconds

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AiGeneration['status'] }) {
  const cfg = {
    pending:    { label: 'Venter',     icon: Clock,         cls: 'bg-muted text-muted-foreground' },
    processing: { label: 'Genererer',  icon: Loader2,       cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    completed:  { label: 'Færdig',     icon: CheckCircle2,  cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
    failed:     { label: 'Fejlede',    icon: XCircle,       cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  }[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {cfg.label}
    </span>
  );
}

// ── Generation card ───────────────────────────────────────────────────────────

function GenerationCard({
  gen, onDelete, onRefresh,
}: {
  gen: AiGeneration;
  onDelete: (id: string) => void;
  onRefresh: (id: string) => void;
}) {
  const isActive = gen.status === 'pending' || gen.status === 'processing';

  return (
    <Card className="overflow-hidden group">
      {/* Media preview */}
      <div className="relative bg-muted aspect-video flex items-center justify-center">
        {gen.status === 'completed' && gen.outputUrl ? (
          gen.type === 'video' ? (
            <video
              src={gen.outputUrl}
              className="w-full h-full object-cover"
              controls
              poster={gen.thumbnailUrl}
            />
          ) : (
            <img
              src={gen.outputUrl}
              alt={gen.prompt}
              className="w-full h-full object-cover"
            />
          )
        ) : gen.status === 'failed' ? (
          <div className="flex flex-col items-center gap-2 text-destructive p-4 text-center">
            <XCircle className="h-8 w-8" />
            <p className="text-xs">{gen.errorMessage || 'Generering fejlede'}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            {gen.type === 'image' ? (
              <ImageIcon className="h-10 w-10 opacity-30" />
            ) : (
              <Video className="h-10 w-10 opacity-30" />
            )}
            {isActive && (
              <div className="flex flex-col items-center gap-1">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-xs">
                  {gen.type === 'video' ? 'Video genereres — kan tage 2-5 min…' : 'Billede genereres…'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Overlay actions */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {gen.status === 'completed' && gen.outputUrl && (
            <a
              href={gen.outputUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-white/90 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          )}
          {isActive && (
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-white/90"
              onClick={() => onRefresh(gen.id)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Opdater
            </button>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{gen.prompt}</p>
          <StatusBadge status={gen.status} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-xs capitalize">
              {gen.type === 'image' ? 'Billede' : 'Video'}
            </Badge>
            {gen.style && <Badge variant="outline" className="text-xs capitalize">{gen.style}</Badge>}
            {gen.aspectRatio && <Badge variant="outline" className="text-xs">{gen.aspectRatio}</Badge>}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Slet generering?</AlertDialogTitle>
                <AlertDialogDescription>
                  Den genererede fil slettes permanent og kan ikke gendannes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuller</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(gen.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Slet permanent
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date(gen.createdAt).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </Card>
  );
}

// ── Image generation tab ──────────────────────────────────────────────────────

function ImageTab({ onGenerated }: { onGenerated: (gen: AiGeneration) => void }) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('realistic');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [generating, setGenerating] = useState(false);

  const promptSuggestions = [
    'Professionel kontor med lyse vinduer og moderne møbler, til LinkedIn annonce',
    'Glad dansk forretningsmand i jakkesæt shake hands, hvid baggrund',
    'Abstrakt blå gradient med geometriske former, til B2B markedsføring',
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: 'Beskriv det billede du vil generere', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const gen = await api.generateAiImage({ prompt: prompt.trim(), style, aspectRatio });
      onGenerated(gen);
      toast({ title: 'Billedgenerering startet', description: 'Billedet vises i historikken om få sekunder' });
      setPrompt('');
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Generering fejlede', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Wand2 className="h-4 w-4 text-purple-500" />
          Beskriv dit billede
        </div>

        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Fx: Professionel CEO ved skrivebord med laptop, moderne kontor, naturligt lys, til LinkedIn annonce..."
          rows={4}
          className="resize-none"
        />

        {/* Prompt suggestions */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Inspiration</p>
          <div className="flex flex-wrap gap-2">
            {promptSuggestions.map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-left max-w-xs"
              >
                {s.slice(0, 60)}…
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Stil</label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Billedformat</label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={() => void handleGenerate()}
          disabled={generating || !prompt.trim()}
          className="w-full"
          size="lg"
        >
          {generating ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Genererer billede…</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-2" />Generer billede</>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Powered by open-source Stable Diffusion — kører på jeres egne servere
        </p>
      </div>
    </div>
  );
}

// ── Video generation tab ──────────────────────────────────────────────────────

function VideoTab({ onGenerated }: { onGenerated: (gen: AiGeneration) => void }) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('realistic');
  const [duration, setDuration] = useState(10);
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [generating, setGenerating] = useState(false);

  const promptSuggestions = [
    'Drone-optagelse over moderne kontorbygning, solskin, professionel stemning',
    'Hænder der ryster ved møde, close-up, erhvervsmæssig tone',
    'Product showcase: mobiltelefon roterer langsomt på hvid baggrund',
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: 'Beskriv den video du vil generere', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const gen = await api.generateAiVideo({
        prompt: prompt.trim(),
        style,
        duration,
        referenceImageUrl: referenceImageUrl.trim() || undefined,
      });
      onGenerated(gen);
      toast({
        title: 'Videogenerering startet',
        description: 'Video generering tager 2-5 minutter. Du finder den i historikken.',
      });
      setPrompt('');
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Generering fejlede', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Play className="h-4 w-4 text-blue-500" />
          Beskriv din video
        </div>

        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Fx: Drone over moderne kontorbygning i København ved solopgang, professionel erhvervsstemning..."
          rows={4}
          className="resize-none"
        />

        {/* Prompt suggestions */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Inspiration</p>
          <div className="flex flex-wrap gap-2">
            {promptSuggestions.map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-left max-w-xs"
              >
                {s.slice(0, 60)}…
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Stil</label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VIDEO_STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Varighed</label>
            <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VIDEO_DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Referencebillede URL <span className="font-normal">(valgfrit — til image-to-video)</span>
          </label>
          <input
            type="url"
            value={referenceImageUrl}
            onChange={(e) => setReferenceImageUrl(e.target.value)}
            placeholder="https://..."
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Videogenerering kræver GPU-kapacitet og tager typisk <strong>2-5 minutter</strong>.
            Du kan fortsætte med at bruge platformen — videoen dukker op i historikken når den er klar.
          </p>
        </div>

        <Button
          onClick={() => void handleGenerate()}
          disabled={generating || !prompt.trim()}
          className="w-full"
          size="lg"
        >
          {generating ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sender til generering…</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-2" />Generer video</>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Powered by open-source Wan2.2 / Open-Sora — kører på jeres egne GPU-servere
        </p>
      </div>
    </div>
  );
}

// ── History / gallery ─────────────────────────────────────────────────────────

type HistoryFilter = { type: 'all' | 'image' | 'video'; status: 'all' | AiGeneration['status'] };

function HistoryTab({
  generations, onDelete, onRefresh, loading,
}: {
  generations: AiGeneration[];
  onDelete: (id: string) => void;
  onRefresh: (id: string) => void;
  loading: boolean;
}) {
  const [filter, setFilter] = useState<HistoryFilter>({ type: 'all', status: 'all' });

  const filtered = generations.filter((g) => {
    if (filter.type !== 'all' && g.type !== filter.type) return false;
    if (filter.status !== 'all' && g.status !== filter.status) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {(['all', 'image', 'video'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter((f) => ({ ...f, type: t }))}
              className={`px-3 py-1.5 transition-colors ${filter.type === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              {t === 'all' ? 'Alle' : t === 'image' ? 'Billeder' : 'Videoer'}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {(['all', 'completed', 'processing', 'pending', 'failed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter((f) => ({ ...f, status: s }))}
              className={`px-3 py-1.5 transition-colors ${filter.status === s ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              {s === 'all' ? 'Alle' : s === 'completed' ? 'Færdige' : s === 'processing' ? 'Aktive' : s === 'pending' ? 'Venter' : 'Fejlede'}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} resultater</span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="flex justify-center">
            <div className="rounded-2xl bg-muted p-5">
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Ingen genereringer fundet</p>
          <p className="text-xs text-muted-foreground">
            Genereringerne vises her så snart du starter din første billede- eller videogenerering
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((gen) => (
            <GenerationCard
              key={gen.id}
              gen={gen}
              onDelete={onDelete}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'image' | 'video' | 'history';

export default function AiMediaPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('image');
  const [generations, setGenerations] = useState<AiGeneration[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Track which IDs are being polled
  const pollingIds = useRef<Set<string>>(new Set());

  // Load history
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.listAiGenerations();
      setGenerations(res.data ?? []);
    } catch {
      /* silent */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  // Poll a single generation until terminal
  const pollGeneration = useCallback(async (id: string) => {
    if (pollingIds.current.has(id)) return;
    pollingIds.current.add(id);

    const tick = async () => {
      try {
        const updated = await api.getAiGenerationStatus(id);
        setGenerations((prev) =>
          prev.map((g) => (g.id === id ? updated : g))
        );
        if (updated.status === 'pending' || updated.status === 'processing') {
          setTimeout(() => void tick(), POLL_INTERVAL);
        } else {
          pollingIds.current.delete(id);
          if (updated.status === 'completed') {
            toast({
              title: `${updated.type === 'image' ? 'Billede' : 'Video'} klar!`,
              description: 'Din generering er fuldført og klar til download.',
            });
          } else if (updated.status === 'failed') {
            toast({
              title: 'Generering fejlede',
              description: updated.errorMessage || 'Prøv igen med en anden prompt.',
              variant: 'destructive',
            });
          }
        }
      } catch {
        pollingIds.current.delete(id);
      }
    };
    setTimeout(() => void tick(), POLL_INTERVAL);
  }, [toast]);

  // When a new generation is submitted
  const handleGenerated = useCallback(
    (gen: AiGeneration) => {
      setGenerations((prev) => [gen, ...prev]);
      setTab('history');
      void pollGeneration(gen.id);
    },
    [pollGeneration]
  );

  // Start polling any active jobs already in history on load
  useEffect(() => {
    generations.forEach((g) => {
      if (g.status === 'pending' || g.status === 'processing') {
        void pollGeneration(g.id);
      }
    });
  }, [generations.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAiGeneration(id);
      setGenerations((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Sletning fejlede', variant: 'destructive' });
    }
  };

  const handleRefresh = async (id: string) => {
    try {
      const updated = await api.getAiGenerationStatus(id);
      setGenerations((prev) => prev.map((g) => (g.id === id ? updated : g)));
    } catch { /* silent */ }
  };

  const activeCount = generations.filter(
    (g) => g.status === 'pending' || g.status === 'processing'
  ).length;

  const tabs = [
    { id: 'image'   as Tab, label: 'Billeder',  icon: ImageIcon },
    { id: 'video'   as Tab, label: 'Videoer',   icon: Video },
    { id: 'history' as Tab, label: 'Historik',  icon: History, badge: activeCount || undefined },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500" />
            AI Mediegenerering
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generer billeder og videoer til annoncer, kampagner og sociale medier direkte i jeres workspace
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadHistory()}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Opdater
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800 px-5 py-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">
            Open-source AI — kører på jeres egne servere
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
            Billeder: Stable Diffusion · Videoer: Wan2.2 / Open-Sora · Ingen data sendes til tredjepart
          </p>
        </div>
        <div className="flex gap-4 text-center text-sm">
          <div>
            <div className="font-bold text-purple-700 dark:text-purple-300">
              {generations.filter((g) => g.type === 'image' && g.status === 'completed').length}
            </div>
            <div className="text-xs text-muted-foreground">Billeder</div>
          </div>
          <div>
            <div className="font-bold text-blue-700 dark:text-blue-300">
              {generations.filter((g) => g.type === 'video' && g.status === 'completed').length}
            </div>
            <div className="text-xs text-muted-foreground">Videoer</div>
          </div>
          {activeCount > 0 && (
            <div>
              <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />{activeCount}
              </div>
              <div className="text-xs text-muted-foreground">Aktive</div>
            </div>
          )}
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-border">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {badge !== undefined && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-amber-500 text-white text-xs font-bold">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'image' && <ImageTab onGenerated={handleGenerated} />}
      {tab === 'video' && <VideoTab onGenerated={handleGenerated} />}
      {tab === 'history' && (
        <HistoryTab
          generations={generations}
          onDelete={(id) => void handleDelete(id)}
          onRefresh={(id) => void handleRefresh(id)}
          loading={historyLoading}
        />
      )}
    </div>
  );
}
