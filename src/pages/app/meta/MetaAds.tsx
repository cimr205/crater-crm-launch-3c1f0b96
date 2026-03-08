import { useCallback, useEffect, useState } from 'react';
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

  const handleGenerate = async () => {
    if (!productDesc.trim()) {
      toast({ title: 'Beskriv dit produkt/ydelse', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setGeneratedCopy(null);
    try {
      const prompt = `Generate 3 Facebook ad variations for: "${productDesc}". Goal: ${goal}. Target audience: ${audience || 'general business audience'}.
      Return JSON: { "headlines": [...3 headlines], "primaryTexts": [...3 primary texts], "ctas": [...3 CTAs] }`;
      const res = await api.aiAnalyzeMeta({ question: prompt });
      // Try to parse JSON from answer
      try {
        const jsonMatch = res.answer.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setGeneratedCopy(parsed);
        } else {
          // Fallback: show as suggestions
          setGeneratedCopy({
            headlines: res.suggestions.slice(0, 3),
            primaryTexts: [res.answer],
            ctas: ['Lær mere', 'Kom i gang', 'Book møde'],
          });
        }
      } catch {
        setGeneratedCopy({
          headlines: res.suggestions.slice(0, 3),
          primaryTexts: [res.answer],
          ctas: ['Lær mere', 'Kom i gang', 'Book møde'],
        });
      }
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

  useEffect(() => { void loadData(); }, [loadData]);

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
            Kampagneoverblik · AI-analyse · Annonce-generator · Rapporter
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
          <TabsList>
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
        </Tabs>
      )}
    </div>
  );
}
