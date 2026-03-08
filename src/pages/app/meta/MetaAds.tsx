import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import {
  TrendingUp, TrendingDown, Bot, RefreshCw, Plus, ExternalLink,
  BarChart2, Sparkles, FileText, ChevronRight, CheckCircle, AlertTriangle,
  DollarSign, MousePointer, Target, Zap, ArrowUpRight, ArrowDownRight,
  Video, Upload, Mic, Image, Clock, Play, Loader2, CheckCircle2,
  XCircle, Layers, ChevronDown, ChevronUp, Globe, Wand2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Campaign = {
  id: string;
  name: string;
  status: string;
  objective: string;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  costPerLead: number;
  conversions?: number;
  roas?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   'bg-green-500/10 text-green-600 border-green-500/20',
  PAUSED:   'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

function fmt(n: number, prefix = '', decimals = 2) {
  return `${prefix}${n.toFixed(decimals)}`;
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ElementType;
  trend?: 'up' | 'down' | null;
}) {
  return (
    <Card className="p-5 bg-card/70 border-border space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex items-end gap-2">
        <div className="text-2xl font-semibold">{value}</div>
        {trend === 'up' && <ArrowUpRight className="h-4 w-4 text-green-500 mb-0.5" />}
        {trend === 'down' && <ArrowDownRight className="h-4 w-4 text-red-500 mb-0.5" />}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

// ─── Connect screen ───────────────────────────────────────────────────────────

function ConnectScreen({ onConnect, loading }: { onConnect: () => void; loading: boolean }) {
  return (
    <Card className="p-10 bg-card/70 border-dashed border-border">
      <div className="text-center space-y-4 max-w-md mx-auto">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 mx-auto">
          <BarChart2 className="h-7 w-7 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Forbind din Meta Ads konto</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Forbind din Meta Business konto for at se kampagner, performance-data og få AI-drevet
            analyse af dine annoncer.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-left">
          {[
            'Spend, CTR, CPC og ROAS',
            'Bedste og dårligste annoncer',
            'AI-anbefalinger per kampagne',
            'Automatiske ugentlige rapporter',
          ].map((f) => (
            <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
              {f}
            </div>
          ))}
        </div>
        <Button onClick={onConnect} disabled={loading} size="lg">
          <ExternalLink className="h-4 w-4 mr-2" />
          Forbind Meta Ads
        </Button>
      </div>
    </Card>
  );
}

// ─── Dashboard tab ────────────────────────────────────────────────────────────

function DashboardTab({
  campaigns,
  loading,
  onRefresh,
  onSync,
  onSelect,
  selected,
}: {
  campaigns: Campaign[];
  loading: boolean;
  onRefresh: () => void;
  onSync: () => void;
  onSelect: (c: Campaign | null) => void;
  selected: Campaign | null;
}) {
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const activeCampaigns = campaigns.filter((c) => c.status === 'ACTIVE');

  const sorted = [...campaigns].sort((a, b) => b.ctr - a.ctr);
  const best = sorted.slice(0, 3);
  const worst = [...campaigns].sort((a, b) => a.ctr - b.ctr).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <KpiCard label="Samlet spend" value={fmt(totalSpend, 'DKK ')} icon={DollarSign} />
        <KpiCard label="Aktive kampagner" value={String(activeCampaigns.length)} icon={Zap} />
        <KpiCard label="Gns. CTR" value={`${avgCtr.toFixed(2)}%`} icon={MousePointer}
          trend={avgCtr > 1.5 ? 'up' : 'down'}
          sub={avgCtr > 1.5 ? 'Over account avg' : 'Under account avg'} />
        <KpiCard label="Gns. CPC" value={fmt(avgCpc, 'DKK ')} icon={Target}
          trend={avgCpc < 5 ? 'up' : 'down'} />
        <KpiCard label="Samlet leads / conv." value={String(totalLeads)} sub={totalLeads > 0 ? `DKK ${avgCpl.toFixed(0)} pr. lead` : undefined} />
      </div>

      {/* Best / Worst */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 bg-card/70 border-border space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-green-600">
            <TrendingUp className="h-4 w-4" />
            Bedste kampagner
          </div>
          {best.length === 0
            ? <p className="text-xs text-muted-foreground">Ingen data endnu</p>
            : best.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-1">
                <div>
                  <div className="text-sm font-medium truncate max-w-48">{c.name}</div>
                  <div className="text-xs text-muted-foreground">CTR {c.ctr.toFixed(2)}% · CPC DKK {c.cpc.toFixed(2)}</div>
                </div>
                <Badge variant="outline" className={`text-xs ${STATUS_COLORS[c.status] || ''}`}>{c.status}</Badge>
              </div>
            ))}
        </Card>

        <Card className="p-5 bg-card/70 border-border space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-600">
            <TrendingDown className="h-4 w-4" />
            Dårligste kampagner
          </div>
          {worst.length === 0
            ? <p className="text-xs text-muted-foreground">Ingen data endnu</p>
            : worst.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-1">
                <div>
                  <div className="text-sm font-medium truncate max-w-48">{c.name}</div>
                  <div className="text-xs text-muted-foreground">CTR {c.ctr.toFixed(2)}% · Spend DKK {c.spend.toFixed(0)}</div>
                </div>
                <div className="flex items-center gap-1">
                  {c.ctr < 0.5 && (
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" title="Lav CTR" />
                  )}
                  <Badge variant="outline" className={`text-xs ${STATUS_COLORS[c.status] || ''}`}>{c.status}</Badge>
                </div>
              </div>
            ))}
        </Card>
      </div>

      {/* Campaign list */}
      <Card className="p-5 bg-card/70 border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Alle kampagner</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onSync} disabled={loading}>
              <RefreshCw className="h-3 w-3 mr-1" />Sync leads
            </Button>
            <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
              <RefreshCw className="h-3 w-3 mr-1" />Opdater
            </Button>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Ingen kampagner fundet. Tjek at din Meta konto er forbundet korrekt.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className={`py-3 flex items-center justify-between cursor-pointer hover:bg-muted/40 rounded px-2 -mx-2 transition-colors ${
                  selected?.id === c.id ? 'bg-muted/60' : ''
                }`}
                onClick={() => onSelect(c.id === selected?.id ? null : c)}
              >
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{c.name}</span>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[c.status] || ''}`}>{c.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.impressions.toLocaleString()} visninger · {c.clicks.toLocaleString()} klik · CTR {c.ctr.toFixed(2)}%
                  </div>
                </div>
                <div className="flex items-center gap-5 text-right shrink-0">
                  <div>
                    <div className="text-sm font-medium">DKK {c.spend.toFixed(0)}</div>
                    <div className="text-xs text-muted-foreground">spend</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">{c.leads}</div>
                    <div className="text-xs text-muted-foreground">leads</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.costPerLead < 50
                      ? <TrendingUp className="h-4 w-4 text-green-500" />
                      : <TrendingDown className="h-4 w-4 text-red-500" />}
                    <span className="text-sm">DKK {c.costPerLead.toFixed(0)}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── AI Analyst tab ───────────────────────────────────────────────────────────

function AiAnalystTab({
  campaigns,
  selected,
  onSelectCampaign,
}: {
  campaigns: Campaign[];
  selected: Campaign | null;
  onSelectCampaign: (c: Campaign | null) => void;
}) {
  const { toast } = useToast();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ answer: string; suggestions: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const quickQuestions = [
    'Hvilken kampagne spender mest uden konverteringer?',
    'Hvad har den bedste CTR og hvorfor?',
    'Hvilke kampagner bør pauses nu?',
    'Hvad skal vi teste næste uge?',
    'Hvordan reducerer vi vores CPC?',
    'Hvilken målgruppe performer bedst?',
  ];

  const handleAnalyze = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer(null);
    try {
      const res = await api.aiAnalyzeMeta({ campaignId: selected?.id, question });
      setAnswer(res);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'AI analyse fejlede', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Context selector */}
      {campaigns.length > 0 && (
        <Card className="p-4 bg-card/70 border-border">
          <div className="text-xs text-muted-foreground mb-2 font-medium">Analysér specifik kampagne (valgfrit)</div>
          <Select
            value={selected?.id ?? 'all'}
            onValueChange={(v) => onSelectCampaign(v === 'all' ? null : campaigns.find((c) => c.id === v) ?? null)}
          >
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Alle kampagner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle kampagner</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected && (
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
              <span>Spend: <strong className="text-foreground">DKK {selected.spend.toFixed(0)}</strong></span>
              <span>CTR: <strong className="text-foreground">{selected.ctr.toFixed(2)}%</strong></span>
              <span>CPL: <strong className="text-foreground">DKK {selected.costPerLead.toFixed(0)}</strong></span>
            </div>
          )}
        </Card>
      )}

      {/* Quick questions */}
      <div>
        <div className="text-xs text-muted-foreground mb-2 font-medium">Hurtige spørgsmål</div>
        <div className="flex flex-wrap gap-2">
          {quickQuestions.map((q) => (
            <button
              key={q}
              className="text-xs rounded-full border border-border px-3 py-1.5 hover:bg-muted hover:text-foreground transition-colors text-muted-foreground"
              onClick={() => setQuestion(q)}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <Textarea
          placeholder="Stil et spørgsmål om dine kampagner og annoncer..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleAnalyze();
          }}
        />
        <Button
          onClick={() => void handleAnalyze()}
          disabled={loading || !question.trim()}
          className="self-end"
          size="lg"
        >
          <Bot className="h-4 w-4 mr-2" />
          {loading ? 'Analyserer...' : 'Analyser'}
        </Button>
      </div>

      {/* Answer */}
      {answer && (
        <Card className="p-5 bg-muted/40 border-border space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-sm leading-relaxed">{answer.answer}</div>
          </div>
          {answer.suggestions.length > 0 && (
            <div className="space-y-2 pl-10">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Næste skridt
              </div>
              <ul className="space-y-1.5">
                {answer.suggestions.map((s, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">→</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Ad Generator tab ─────────────────────────────────────────────────────────

function AdGeneratorTab({
  campaigns,
  selected,
}: {
  campaigns: Campaign[];
  selected: Campaign | null;
}) {
  const { toast } = useToast();
  const [campaignId, setCampaignId] = useState(selected?.id ?? '');
  const [adName, setAdName] = useState('');
  const [primaryText, setPrimaryText] = useState('');
  const [headline, setHeadline] = useState('');
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generatedCopy, setGeneratedCopy] = useState<{
    headlines: string[];
    primaryTexts: string[];
    ctas: string[];
  } | null>(null);
  const [productDesc, setProductDesc] = useState('');
  const [goal, setGoal] = useState('leads');
  const [audience, setAudience] = useState('');

  const parseAdCopy = (answer: string, suggestions: string[]) => {
    const defaultCtas = ['Lær mere', 'Kom i gang', 'Book gratis demo'];
    // 1. Try fenced JSON block
    try {
      const fenced = answer.match(/```json\s*([\s\S]*?)\s*```/);
      if (fenced) {
        const p = JSON.parse(fenced[1]) as { headlines?: string[]; primaryTexts?: string[]; ctas?: string[] };
        if (Array.isArray(p.headlines) && p.headlines.length > 0) return p;
      }
    } catch { /* fall through */ }
    // 2. Try bare JSON object
    try {
      const bare = answer.match(/\{[\s\S]*"headlines"[\s\S]*\}/);
      if (bare) {
        const p = JSON.parse(bare[0]) as { headlines?: string[]; primaryTexts?: string[]; ctas?: string[] };
        if (Array.isArray(p.headlines) && p.headlines.length > 0) return p;
      }
    } catch { /* fall through */ }
    // 3. Extract via numbered list pattern (1. / **1.** / Variation 1:)
    const blocks = answer.split(/(?:^|\n)(?:\*\*)?(?:Variation\s*)?\d+[.)]\s*/m).filter(b => b.trim().length > 20);
    if (blocks.length >= 2) {
      return {
        headlines: blocks.slice(0, 3).map(b => b.split('\n')[0].replace(/^\*+/, '').trim().slice(0, 80)),
        primaryTexts: blocks.slice(0, 3).map(b => b.replace(/\n+/g, ' ').trim().slice(0, 300)),
        ctas: suggestions.length >= 3 ? suggestions.slice(0, 3) : defaultCtas,
      };
    }
    // 4. Last resort: use suggestions as headlines
    const headlines = (suggestions.length >= 3 ? suggestions : [answer]).slice(0, 3);
    return {
      headlines: headlines.map(h => h.slice(0, 80)),
      primaryTexts: headlines.map(() => answer.slice(0, 300)),
      ctas: defaultCtas,
    };
  };

  const handleGenerate = async () => {
    if (!productDesc.trim()) {
      toast({ title: 'Beskriv dit produkt/ydelse', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setGeneratedCopy(null);
    try {
      const prompt = `Du er en dansk Meta Ads ekspert. Generer præcis 3 Facebook/Instagram annonce-variationer til dette produkt: "${productDesc}". Mål: ${goal}. Målgruppe: ${audience || 'danske B2B beslutningstagere'}.

Svar KUN med dette JSON-format uden forklaring:
{
  "headlines": ["Headline 1 (max 40 tegn)", "Headline 2", "Headline 3"],
  "primaryTexts": ["Primary text 1 (2-3 sætninger)", "Primary text 2", "Primary text 3"],
  "ctas": ["Lær mere", "Kom i gang", "Book demo"]
}`;
      const res = await api.aiAnalyzeMeta({ question: prompt });
      setGeneratedCopy(parseAdCopy(res.answer, res.suggestions));
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Generering fejlede', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateAd = async () => {
    if (!campaignId || !adName.trim()) return;
    setCreating(true);
    try {
      await api.createMetaAd({
        campaignId,
        adSetId: '',
        name: adName,
        primaryText,
        headline,
        callToAction: 'LEARN_MORE',
      });
      toast({ title: 'Annonce oprettet' });
      setAdName('');
      setPrimaryText('');
      setHeadline('');
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Oprettelse fejlede', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Generator */}
      <Card className="p-5 bg-card/70 border-border space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">AI Annonce-generator</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Beskriv dit produkt og mål — AI genererer 3 annonce-variationer med headline, primary text og CTA.
        </p>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Produkt / ydelse *</label>
            <Textarea
              placeholder="Vi sælger CRM-software til danske SMV'er med 5-50 medarbejdere..."
              value={productDesc}
              onChange={(e) => setProductDesc(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Kampagnemål</label>
              <Select value={goal} onValueChange={setGoal}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leads">Leads / Tilmeldinger</SelectItem>
                  <SelectItem value="sales">Salg / Konverteringer</SelectItem>
                  <SelectItem value="awareness">Brand awareness</SelectItem>
                  <SelectItem value="traffic">Website trafik</SelectItem>
                  <SelectItem value="engagement">Engagement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Målgruppe</label>
              <Input
                placeholder="B2B beslutningstagere, 30-50 år, DK"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={() => void handleGenerate()} disabled={generating || !productDesc.trim()}>
            <Sparkles className="h-4 w-4 mr-2" />
            {generating ? 'Genererer...' : 'Generer 3 variationer'}
          </Button>
        </div>

        {generatedCopy && (
          <div className="space-y-4 pt-2 border-t border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Genererede variationer
            </div>
            {(generatedCopy.headlines ?? []).map((h, i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <div className="text-xs text-muted-foreground font-medium">Variation {i + 1}</div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Headline</div>
                  <div className="text-sm font-semibold">{h}</div>
                </div>
                {(generatedCopy.primaryTexts ?? [])[i] && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Primary text</div>
                    <div className="text-sm">{generatedCopy.primaryTexts[i]}</div>
                  </div>
                )}
                {(generatedCopy.ctas ?? [])[i] && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">CTA</div>
                    <Badge variant="outline" className="text-xs">{generatedCopy.ctas[i]}</Badge>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setHeadline(h);
                    setPrimaryText((generatedCopy.primaryTexts ?? [])[i] ?? '');
                  }}
                >
                  Brug denne variation
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create ad form */}
      <Card className="p-5 bg-card/70 border-border space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">Opret annonce i Meta</div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Kampagne</label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg kampagne" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Annonce navn *</label>
            <Input placeholder="Annonce navn" value={adName} onChange={(e) => setAdName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Headline</label>
            <Input placeholder="Headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Primary text</label>
            <Textarea
              placeholder="Primary text — det der vises under billedet"
              value={primaryText}
              onChange={(e) => setPrimaryText(e.target.value)}
              rows={3}
            />
          </div>
          <Button
            onClick={() => void handleCreateAd()}
            disabled={creating || !campaignId || !adName.trim()}
          >
            <Plus className="h-4 w-4 mr-2" />
            {creating ? 'Opretter...' : 'Opret annonce i Meta'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─── Reports tab ──────────────────────────────────────────────────────────────

function ReportsTab({ campaigns }: { campaigns: Campaign[] }) {
  const { toast } = useToast();
  const [reportPeriod, setReportPeriod] = useState<'week' | 'month'>('week');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [report, setReport] = useState<{ answer: string; suggestions: string[] } | null>(null);

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const bestCampaign = [...campaigns].sort((a, b) => b.ctr - a.ctr)[0];
  const worstCampaign = [...campaigns].sort((a, b) => a.ctr - b.ctr)[0];

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    setReport(null);
    try {
      const campaignSummary = campaigns
        .slice(0, 5)
        .map((c) => `${c.name}: spend=${c.spend.toFixed(0)}, CTR=${c.ctr.toFixed(2)}%, leads=${c.leads}, CPL=${c.costPerLead.toFixed(0)}`)
        .join('\n');

      const prompt = `Generate a ${reportPeriod === 'week' ? 'weekly' : 'monthly'} marketing report summary in Danish for these Meta Ads campaigns:\n${campaignSummary}\n\nTotal spend: ${totalSpend.toFixed(0)} DKK, Total leads: ${totalLeads}, Avg CTR: ${avgCtr.toFixed(2)}%\n\nInclude: best campaign, worst campaign, spend analysis, concrete next actions.`;

      const res = await api.aiAnalyzeMeta({ question: prompt });
      setReport(res);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Rapport fejlede', variant: 'destructive' });
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Report stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total spend" value={`DKK ${totalSpend.toFixed(0)}`} icon={DollarSign} />
        <KpiCard label="Gns. CTR" value={`${avgCtr.toFixed(2)}%`} icon={MousePointer} trend={avgCtr > 1.5 ? 'up' : 'down'} />
        <KpiCard label="Leads" value={String(totalLeads)} icon={Target} />
        <KpiCard label="Klik" value={totalClicks.toLocaleString()} icon={MousePointer} />
      </div>

      {/* Best / Worst summary */}
      {campaigns.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5 bg-card/70 border-border space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-green-600">
              <TrendingUp className="h-4 w-4" />
              Ugens bedste annonce
            </div>
            {bestCampaign && (
              <div>
                <div className="text-sm font-medium">{bestCampaign.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  CTR {bestCampaign.ctr.toFixed(2)}% · DKK {bestCampaign.spend.toFixed(0)} spend · {bestCampaign.leads} leads
                </div>
              </div>
            )}
          </Card>
          <Card className="p-5 bg-card/70 border-border space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-500">
              <TrendingDown className="h-4 w-4" />
              Ugens dårligste annonce
            </div>
            {worstCampaign && (
              <div>
                <div className="text-sm font-medium">{worstCampaign.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  CTR {worstCampaign.ctr.toFixed(2)}% · DKK {worstCampaign.spend.toFixed(0)} spend
                </div>
                {worstCampaign.ctr < 0.5 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-yellow-600">
                    <AlertTriangle className="h-3 w-3" />
                    Overvej at pause denne annonce
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* AI Report generator */}
      <Card className="p-5 bg-card/70 border-border space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">AI Marketing rapport</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Generer en AI-skrevet marketing-rapport baseret på dine aktuelle kampagnedata.
          Rapporten inkluderer analyse, anbefalinger og næste skridt.
        </p>
        <div className="flex items-center gap-3">
          <Select value={reportPeriod} onValueChange={(v) => setReportPeriod(v as 'week' | 'month')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Ugentlig rapport</SelectItem>
              <SelectItem value="month">Månedlig rapport</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => void handleGenerateReport()}
            disabled={generatingReport || campaigns.length === 0}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {generatingReport ? 'Genererer...' : 'Generer rapport'}
          </Button>
        </div>

        {report && (
          <div className="rounded-lg border border-border bg-muted/30 p-5 space-y-4">
            <div className="text-sm leading-relaxed whitespace-pre-line">{report.answer}</div>
            {report.suggestions.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-border">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Anbefalede handlinger
                </div>
                <ul className="space-y-1.5">
                  {report.suggestions.map((s, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Architecture info */}
      <Card className="p-5 bg-blue-500/5 border-blue-500/20 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
          <Zap className="h-4 w-4" />
          Marketing AI stack
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs text-muted-foreground">
          {[
            { layer: 'Lag 1 — Data', desc: 'Meta Business SDK → kampagner, spend, CTR, CPC, ROAS' },
            { layer: 'Lag 2 — AI analyse', desc: 'OpenAI GPT-4 → konkrete anbefalinger baseret på data' },
            { layer: 'Lag 3 — Automatisering', desc: 'n8n workflows → ugentlige rapporter + Slack/email notifikationer' },
            { layer: 'Lag 4 — Budget analyse', desc: 'Robyn MMM → langsigtet kanaleffektivitet og budgetallokering' },
            { layer: 'Lag 5 — Kreativ gen.', desc: 'AI genererer headlines, primary texts og kreative retninger' },
            { layer: 'Fremtid', desc: 'Google Ads + TikTok Ads + cross-channel attribution' },
          ].map((item) => (
            <div key={item.layer} className="space-y-0.5">
              <div className="text-xs font-semibold text-foreground">{item.layer}</div>
              <div>{item.desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Video Ad Creator tab ─────────────────────────────────────────────────────
//
// GPU-PROBLEM FORKLARING:
// Modeller som InfiniteTalk og MuseTalk kræver CUDA + PyTorch og mange GB VRAM.
// En browser kan aldrig køre tung GPU-inference — den har ingen adgang til NVIDIA
// CUDA-kerner. Løsningen er at browseren kun sender et job til backend-API'et,
// som videregivem jobbet til en separat GPU-worker (RunPod / Modal / self-hosted
// server). Frontend poller status hvert 3. sekund, indtil jobbet er færdigt.

type VideoProvider = 'infinitetalk' | 'musetalk' | 'skyreels' | 'realvideo';

const PROVIDERS: {
  id: VideoProvider;
  name: string;
  badge: string;
  description: string;
  bestFor: string[];
  emoji: string;
}[] = [
  {
    id: 'musetalk',
    name: 'MuseTalk',
    badge: 'Hurtig MVP',
    description: 'Real-time lip-sync model. 30fps+ på RTX. Ideel til korte talking-head ads.',
    bestFor: ['Korte ads (< 30 sek)', 'Hurtig proof-of-concept', 'Avatar der læser speak'],
    emoji: '🎙️',
  },
  {
    id: 'infinitetalk',
    name: 'InfiniteTalk',
    badge: 'Anbefalet',
    description: 'Audio-drevet talking video. Understøtter unbegrænset længde, image-to-video og video-to-video.',
    bestFor: ['Lange talking videos', 'Dubbed video ads', 'UGC-style founder videos'],
    emoji: '🎬',
  },
  {
    id: 'skyreels',
    name: 'SkyReels V3',
    badge: 'Premium',
    description: 'Multi-subject video, audio-guided og talking avatar. Kræver CUDA 12.8+ og Python 3.12+.',
    bestFor: ['Filmiske video ads', 'Multi-subject scenes', 'Avanceret retargeting'],
    emoji: '🎥',
  },
  {
    id: 'realvideo',
    name: 'RealVideo',
    badge: 'Conversational',
    description: 'Transformerer tekst til high-fidelity video response. Upload avatar + stemme + tekst.',
    bestFor: ['AI spokespersons', 'Landing page videos', 'Chat-baserede video replies'],
    emoji: '🤖',
  },
];

const HOOK_TEMPLATES = [
  'Træt af at bruge tid på leads?',
  'Mister du kunder hver uge?',
  'Få styr på CRM, HR og drift i ét system',
  'Stop med at bruge 3 systemer — brug ét',
  'Lad AI klare din administration',
  'Se hvordan du sparer tid på administration',
  '80% af din tid spildes her — fix det nu',
  'Du kiggede på vores løsning, men bookede ikke demo',
];

type VideoJob = {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  video_url?: string;
  thumbnail_url?: string;
  provider: string;
  script: string;
  variant_label?: string;
  created_at: string;
  error?: string;
};

// ── Drag-drop upload zone ────────────────────────────────────────────────────

function DropZone({
  label,
  accept,
  icon: Icon,
  value,
  onFile,
  onClear,
}: {
  label: string;
  accept: string;
  icon: React.ElementType;
  value: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 cursor-pointer transition-colors select-none ${
        dragging
          ? 'border-primary bg-primary/5'
          : value
          ? 'border-green-500/50 bg-green-500/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/30'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => ref.current?.click()}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      {value ? (
        <div className="text-center space-y-1">
          <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto" />
          <p className="text-xs font-medium truncate max-w-32">{value.name}</p>
          <button
            className="text-xs text-muted-foreground underline"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
          >
            Fjern
          </button>
        </div>
      ) : (
        <div className="text-center space-y-2">
          <Icon className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="text-xs font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">Træk fil hertil eller klik</p>
        </div>
      )}
    </div>
  );
}

// ── Job status card ──────────────────────────────────────────────────────────

function JobCard({
  job,
  campaigns,
  onSaved,
}: {
  job: VideoJob;
  campaigns: Campaign[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveCampaignId, setSaveCampaignId] = useState('');
  const [showSave, setShowSave] = useState(false);

  const provider = PROVIDERS.find((p) => p.id === job.provider);
  const statusColor = {
    queued:     'text-yellow-600 bg-yellow-500/10',
    processing: 'text-blue-600 bg-blue-500/10',
    completed:  'text-green-600 bg-green-500/10',
    failed:     'text-red-600 bg-red-500/10',
  }[job.status];

  const statusLabel = {
    queued:     'I kø',
    processing: 'Genererer…',
    completed:  'Færdig',
    failed:     'Fejlet',
  }[job.status];

  const saveCreative = async () => {
    if (!saveName.trim() || !saveCampaignId) return;
    setSaving(true);
    try {
      await api.saveVideoAsAdCreative(job.job_id, {
        name: saveName,
        campaignId: saveCampaignId,
        variantLabel: job.variant_label,
      });
      toast({ title: `"${saveName}" gemt som annonce-kreativ` });
      setShowSave(false);
      onSaved();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Gem fejlede', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <span className="text-lg">{provider?.emoji ?? '🎬'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{job.variant_label || provider?.name || job.provider}</p>
          <p className="text-xs text-muted-foreground truncate">{job.script.slice(0, 60)}{job.script.length > 60 ? '…' : ''}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusColor}`}>
          {job.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
          {job.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
          {job.status === 'failed' && <XCircle className="h-3 w-3" />}
          {statusLabel}
        </span>
      </div>

      {/* Progress bar */}
      {job.status === 'processing' && (
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${job.progress ?? 10}%` }}
          />
        </div>
      )}

      {/* Video preview */}
      {job.status === 'completed' && job.video_url && (
        <div className="p-4 space-y-3">
          <video
            src={job.video_url}
            poster={job.thumbnail_url}
            controls
            className="w-full rounded-lg max-h-64 bg-black"
          />
          <div className="flex gap-2 flex-wrap">
            <a href={job.video_url} download className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
              Download video
            </a>
            <button
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              onClick={() => setShowSave((v) => !v)}
            >
              <Layers className="h-3.5 w-3.5" />
              Gem som annonce-kreativ
              {showSave ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          {showSave && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <Input
                className="h-8 text-xs"
                placeholder="Navn på kreativet"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
              <Select value={saveCampaignId} onValueChange={setSaveCampaignId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Vælg kampagne" /></SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" className="w-full" onClick={() => void saveCreative()} disabled={saving || !saveName.trim() || !saveCampaignId}>
                {saving ? 'Gemmer…' : 'Gem kreativ'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {job.status === 'failed' && job.error && (
        <div className="px-4 py-3 text-xs text-destructive">{job.error}</div>
      )}
    </div>
  );
}

// ── Main video tab ────────────────────────────────────────────────────────────

function VideoAdCreatorTab({ campaigns }: { campaigns: Campaign[] }) {
  const { toast } = useToast();

  // Provider
  const [provider, setProvider] = useState<VideoProvider>('musetalk');

  // Script + hooks
  const [script, setScript] = useState('');
  const [hooks, setHooks] = useState<string[]>(['']);
  const [abMode, setAbMode] = useState(false);

  // Files
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [sourceVideoFile, setSourceVideoFile] = useState<File | null>(null);

  // TTS fallback
  const [audioMode, setAudioMode] = useState<'upload' | 'tts'>('upload');
  const [ttsText, setTtsText] = useState('');

  // Settings
  const [duration, setDuration] = useState(15);
  const [language, setLanguage] = useState('da');

  // Jobs
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const res = await api.listVideoJobs();
      setJobs(res.data as VideoJob[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  // Poll aktive jobs hvert 3. sekund
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'queued' || j.status === 'processing');
    if (hasActive && !pollingRef.current) {
      pollingRef.current = setInterval(() => void loadJobs(), 3000);
    } else if (!hasActive && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [jobs, loadJobs]);

  const uploadAsset = async (file: File, type: 'avatar' | 'audio' | 'video') => {
    const res = await api.uploadVideoJobAsset(file, type);
    return res.url;
  };

  const handleSubmit = async () => {
    if (!script.trim()) { toast({ title: 'Skriv et manuskript', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      let avatarUrl: string | undefined;
      let audioUrl: string | undefined;
      let sourceVideoUrl: string | undefined;

      if (avatarFile) avatarUrl = await uploadAsset(avatarFile, 'avatar');
      if (audioFile && audioMode === 'upload') audioUrl = await uploadAsset(audioFile, 'audio');
      if (sourceVideoFile) sourceVideoUrl = await uploadAsset(sourceVideoFile, 'video');

      const hookVariants = abMode ? hooks.filter((h) => h.trim()) : undefined;

      const payload = {
        provider,
        script,
        avatarUrl: avatarUrl ?? sourceVideoUrl,
        audioUrl,
        ttsText: audioMode === 'tts' ? ttsText : undefined,
        durationSeconds: duration,
        language,
        hookVariants,
      };

      await api.submitVideoJob(payload);
      toast({ title: 'Video-job sendt til GPU-worker', description: 'Generering starter straks. Polling hvert 3. sekund.' });
      await loadJobs();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Job-indsendelse fejlede', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProvider = PROVIDERS.find((p) => p.id === provider)!;
  const activeJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'processing');
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const failedJobs = jobs.filter((j) => j.status === 'failed');

  return (
    <div className="space-y-6">
      {/* GPU forklaring banner */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 flex gap-3">
        <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-semibold">Hvordan video-generering virker</p>
          <p>
            Din browser kan <strong>ikke</strong> køre GPU-modeller (CUDA, PyTorch). Systemet sender jobbet
            til en backend GPU-worker (RunPod / Modal), som kører InfiniteTalk, MuseTalk osv. Frontend
            poller status hvert 3. sekund og viser videoen, når den er klar.
          </p>
        </div>
      </div>

      {/* Provider valg */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Video-model</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className={`rounded-xl border p-4 text-left transition-all ${
                provider === p.id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/40 hover:bg-muted/20'
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-2">
                <span className="text-xl">{p.emoji}</span>
                <span className="text-xs rounded-full bg-muted px-2 py-0.5 font-medium">{p.badge}</span>
              </div>
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{p.description}</p>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedProvider.bestFor.map((item) => (
            <span key={item} className="text-xs bg-primary/10 text-primary rounded-full px-2.5 py-1">
              ✓ {item}
            </span>
          ))}
        </div>
      </div>

      {/* Script + A/B hooks */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            Manuskript
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-muted-foreground">A/B hooks</span>
            <button
              onClick={() => setAbMode((v) => !v)}
              className={`relative h-5 w-9 rounded-full transition-colors ${abMode ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${abMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>

        <Textarea
          placeholder="Skriv manuskriptet til din video-ad... fx: 'Træt af at miste leads? I Crater CRM samler du alt på ét sted. Book en gratis demo i dag.'"
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={4}
        />

        {/* A/B hook variants */}
        {abMode && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Hook-varianter (de første 2-3 sek pr. variant)</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {HOOK_TEMPLATES.map((h) => (
                <button
                  key={h}
                  className="text-xs rounded-full border border-border px-2.5 py-1 hover:bg-muted transition-colors"
                  onClick={() => { if (!hooks.includes(h)) setHooks((prev) => [...prev.filter((x) => x), h]); }}
                >
                  {h}
                </button>
              ))}
            </div>
            {hooks.map((h, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  className="h-8 text-xs"
                  placeholder={`Hook ${i + 1}`}
                  value={h}
                  onChange={(e) => setHooks((prev) => prev.map((v, idx) => idx === i ? e.target.value : v))}
                />
                {hooks.length > 1 && (
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setHooks((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setHooks((prev) => [...prev, ''])}>
              <Plus className="h-3.5 w-3.5 mr-1" />Tilføj hook-variant
            </Button>
          </div>
        )}
      </div>

      {/* Uploads */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          Mediafiler
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Avatar / billede</p>
            <DropZone
              label="Upload avatar"
              accept="image/*"
              icon={Image}
              value={avatarFile}
              onFile={setAvatarFile}
              onClear={() => setAvatarFile(null)}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Kilde-video (valgfri)</p>
            <DropZone
              label="Upload video"
              accept="video/*"
              icon={Video}
              value={sourceVideoFile}
              onFile={setSourceVideoFile}
              onClear={() => setSourceVideoFile(null)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-medium text-muted-foreground">Lyd</p>
              <div className="flex gap-1">
                {(['upload', 'tts'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setAudioMode(mode)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      audioMode === mode ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {mode === 'upload' ? 'Upload' : 'TTS'}
                  </button>
                ))}
              </div>
            </div>
            {audioMode === 'upload' ? (
              <DropZone
                label="Upload voiceover"
                accept="audio/*"
                icon={Mic}
                value={audioFile}
                onFile={setAudioFile}
                onClear={() => setAudioFile(null)}
              />
            ) : (
              <Textarea
                rows={3}
                placeholder="Skriv tekst til TTS-stemme — backend konverterer til lyd automatisk..."
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                className="text-xs"
              />
            )}
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Indstillinger
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Varighed</label>
            <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[7, 10, 15, 20, 30, 45, 60].map((s) => (
                  <SelectItem key={s} value={String(s)}>{s} sekunder</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" />Sprog
            </label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="da">Dansk</SelectItem>
                <SelectItem value="en">Engelsk</SelectItem>
                <SelectItem value="sv">Svensk</SelectItem>
                <SelectItem value="no">Norsk</SelectItem>
                <SelectItem value="de">Tysk</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Submit */}
      <Button
        size="lg"
        className="w-full"
        onClick={() => void handleSubmit()}
        disabled={submitting || !script.trim()}
      >
        {submitting
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploader filer og sender job…</>
          : <><Play className="h-4 w-4 mr-2" />Generer video-ad med {selectedProvider.name}</>}
      </Button>

      {/* Job liste */}
      {jobs.length > 0 && (
        <div className="space-y-4">
          {activeJobs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <p className="text-sm font-semibold">Aktive jobs ({activeJobs.length})</p>
                <span className="text-xs text-muted-foreground">Opdateres automatisk hvert 3. sek</span>
              </div>
              {activeJobs.map((j) => (
                <JobCard key={j.job_id} job={j} campaigns={campaigns} onSaved={() => void loadJobs()} />
              ))}
            </div>
          )}

          {completedJobs.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-green-600 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Færdige videoer ({completedJobs.length})
              </p>
              {completedJobs.map((j) => (
                <JobCard key={j.job_id} job={j} campaigns={campaigns} onSaved={() => void loadJobs()} />
              ))}
            </div>
          )}

          {failedJobs.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Fejlede jobs ({failedJobs.length})
              </p>
              {failedJobs.map((j) => (
                <JobCard key={j.job_id} job={j} campaigns={campaigns} onSaved={() => void loadJobs()} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MetaAdsPage() {
  const { toast } = useToast();
  const [metaConnected, setMetaConnected] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState('dashboard');

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [statusRes, campaignsRes] = await Promise.all([
        api.getMetaStatus(),
        api.getMetaCampaigns().catch(() => ({ data: [] })),
      ]);
      setMetaConnected(statusRes.connected);
      setCampaigns((campaignsRes as { data: Campaign[] }).data ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Kunne ikke hente Meta-data');
    }
  }, []);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => void loadData(), 5 * 60 * 1000); // 5 min
    return () => clearInterval(interval);
  }, [loadData]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await api.startMetaConnect();
      const width = 520, height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(res.auth_url, 'Connect Meta', `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Forbindelsen fejlede', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      await api.syncMetaLeads();
      toast({ title: 'Meta leads synkroniseret' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Sync fejlede', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart2 className="h-6 w-6" />
            Meta Ads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kampagneoverblik · AI-analyse · Annonce-generator · Video AI · Rapporter
          </p>
        </div>
        <div className="flex items-center gap-2">
          {metaConnected && (
            <Badge className="bg-green-500/15 text-green-600 border-green-500/20">
              <CheckCircle className="h-3 w-3 mr-1" />
              Forbundet
            </Badge>
          )}
          {!metaConnected && (
            <Button size="sm" onClick={() => void handleConnect()} disabled={loading}>
              <ExternalLink className="h-4 w-4 mr-1" />
              Forbind Meta
            </Button>
          )}
        </div>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {!metaConnected ? (
        <ConnectScreen onConnect={() => void handleConnect()} loading={loading} />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
              <BarChart2 className="h-3.5 w-3.5" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              AI Analyst
            </TabsTrigger>
            <TabsTrigger value="generator" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Ad Generator
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Rapporter
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Video className="h-3.5 w-3.5" />
              Video AI
              <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs font-bold leading-none">NY</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <DashboardTab
              campaigns={campaigns}
              loading={loading}
              onRefresh={() => void loadData()}
              onSync={() => void handleSync()}
              onSelect={setSelected}
              selected={selected}
            />
          </TabsContent>

          <TabsContent value="ai" className="mt-6">
            <AiAnalystTab
              campaigns={campaigns}
              selected={selected}
              onSelectCampaign={setSelected}
            />
          </TabsContent>

          <TabsContent value="generator" className="mt-6">
            <AdGeneratorTab campaigns={campaigns} selected={selected} />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <ReportsTab campaigns={campaigns} />
          </TabsContent>

          <TabsContent value="video" className="mt-6">
            <VideoAdCreatorTab campaigns={campaigns} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
