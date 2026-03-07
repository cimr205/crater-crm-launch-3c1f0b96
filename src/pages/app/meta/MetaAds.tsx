import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { TrendingUp, TrendingDown, Bot, RefreshCw, Plus, ExternalLink, ChevronRight } from 'lucide-react';

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
};

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-600 border-green-500/20',
  PAUSED: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4 space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function MetaAdsPage() {
  const { toast } = useToast();
  const [metaConnected, setMetaConnected] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<{ answer: string; suggestions: string[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // New ad form
  const [showCreateAd, setShowCreateAd] = useState(false);
  const [newAdName, setNewAdName] = useState('');
  const [newAdPrimaryText, setNewAdPrimaryText] = useState('');
  const [newAdHeadline, setNewAdHeadline] = useState('');

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [statusRes, campaignsRes] = await Promise.all([
        api.getMetaStatus(),
        api.getMetaCampaigns().catch(() => ({ data: [] })),
      ]);
      setMetaConnected(statusRes.connected);
      setCampaigns((campaignsRes as { data: Campaign[] }).data || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load Meta data');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await api.startMetaConnect();
      const width = 520, height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        res.auth_url,
        'Connect Meta',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Connection failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncLeads = async () => {
    setLoading(true);
    try {
      await api.syncMetaLeads();
      toast({ title: 'Meta leads synced' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Sync failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAiAnalyze = async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    setAiAnswer(null);
    try {
      const res = await api.aiAnalyzeMeta({
        campaignId: selectedCampaign?.id,
        question: aiQuestion,
      });
      setAiAnswer(res);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'AI analysis failed', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateAd = async () => {
    if (!selectedCampaign || !newAdName.trim()) return;
    setLoading(true);
    try {
      await api.createMetaAd({
        campaignId: selectedCampaign.id,
        adSetId: '',
        name: newAdName,
        primaryText: newAdPrimaryText,
        headline: newAdHeadline,
        callToAction: 'LEARN_MORE',
      });
      toast({ title: 'Ad created' });
      setShowCreateAd(false);
      setNewAdName('');
      setNewAdPrimaryText('');
      setNewAdHeadline('');
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not create ad', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    'Hvorfor performer denne kampagne dårligt?',
    'Hvad skal jeg ændre for at få billigere leads?',
    'Er CTR god nok eller for lav?',
    'Kan du skrive bedre primary text?',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Meta Ads</h1>
          <p className="text-sm text-muted-foreground">
            Administrer kampagner, annoncer og analyse med AI-assistance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSyncLeads} disabled={loading || !metaConnected}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Sync leads
          </Button>
          {!metaConnected && (
            <Button size="sm" onClick={handleConnect} disabled={loading}>
              <ExternalLink className="h-4 w-4 mr-1" />
              Forbind Meta
            </Button>
          )}
        </div>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {/* Connection status */}
      {!metaConnected && (
        <Card className="p-6 bg-card/70 border-dashed border-border">
          <div className="text-center space-y-3">
            <div className="text-4xl">📣</div>
            <div className="font-semibold">Forbind din Meta Ads konto</div>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Forbind din Meta Business konto for at se kampagner, performance og få AI-analyse af dine annoncer.
            </p>
            <Button onClick={handleConnect} disabled={loading}>
              Forbind Meta Ads
            </Button>
          </div>
        </Card>
      )}

      {/* Campaign list */}
      {metaConnected && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Aktive kampagner"
              value={String(campaigns.filter((c) => c.status === 'ACTIVE').length)}
            />
            <MetricCard
              label="Samlet spend"
              value={`$${campaigns.reduce((sum, c) => sum + c.spend, 0).toFixed(2)}`}
            />
            <MetricCard
              label="Samlet leads"
              value={String(campaigns.reduce((sum, c) => sum + c.leads, 0))}
            />
            <MetricCard
              label="Gns. CPL"
              value={
                campaigns.length
                  ? `$${(campaigns.reduce((sum, c) => sum + c.costPerLead, 0) / campaigns.length).toFixed(2)}`
                  : '—'
              }
            />
          </div>

          <Card className="p-5 bg-card/70 border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Kampagner</div>
              <Button size="sm" variant="outline" onClick={() => loadData()} disabled={loading}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Opdater
              </Button>
            </div>

            {campaigns.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Ingen kampagner fundet. Tjek at din Meta konto er forbundet korrekt.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className={`py-3 flex items-center justify-between cursor-pointer hover:bg-muted/40 rounded px-2 -mx-2 transition-colors ${
                      selectedCampaign?.id === campaign.id ? 'bg-muted/60' : ''
                    }`}
                    onClick={() => setSelectedCampaign(campaign.id === selectedCampaign?.id ? null : campaign)}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{campaign.name}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusColors[campaign.status] || ''}`}
                        >
                          {campaign.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {campaign.impressions.toLocaleString()} visninger ·{' '}
                        {campaign.clicks.toLocaleString()} klik · CTR {campaign.ctr.toFixed(2)}%
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-sm font-medium">${campaign.spend.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">spend</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">{campaign.leads}</div>
                        <div className="text-xs text-muted-foreground">leads</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {campaign.costPerLead < 10 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm">${campaign.costPerLead.toFixed(2)}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Selected campaign: create ad */}
          {selectedCampaign && (
            <Card className="p-5 bg-card/70 border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{selectedCampaign.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Budget: ${selectedCampaign.budget} · Objective: {selectedCampaign.objective}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateAd(!showCreateAd)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ny annonce
                </Button>
              </div>

              {showCreateAd && (
                <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
                  <div className="text-sm font-medium">Opret ny annonce</div>
                  <Input
                    placeholder="Annonce navn"
                    value={newAdName}
                    onChange={(e) => setNewAdName(e.target.value)}
                  />
                  <Textarea
                    placeholder="Primary text — det der vises under billedet"
                    value={newAdPrimaryText}
                    onChange={(e) => setNewAdPrimaryText(e.target.value)}
                    rows={3}
                  />
                  <Input
                    placeholder="Headline"
                    value={newAdHeadline}
                    onChange={(e) => setNewAdHeadline(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreateAd} disabled={loading || !newAdName.trim()}>
                      Opret annonce
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowCreateAd(false)}>
                      Annuller
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* AI Analysis panel */}
      <Card className="p-5 bg-card/70 border-border space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">AI Annonce-analyse</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Stil et spørgsmål om dine kampagner eller annoncer — AI'en bruger OpenAI til at analysere
          performance og give konkrete forslag.
        </p>

        <div className="flex flex-wrap gap-2">
          {quickQuestions.map((q) => (
            <button
              key={q}
              className="text-xs rounded-full border border-border px-3 py-1 hover:bg-muted transition-colors"
              onClick={() => setAiQuestion(q)}
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Textarea
            placeholder="Stil et spørgsmål om dine annoncer..."
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            rows={2}
            className="flex-1"
          />
          <Button
            onClick={handleAiAnalyze}
            disabled={aiLoading || !aiQuestion.trim()}
            className="self-end"
          >
            {aiLoading ? 'Analyserer...' : 'Analyser'}
          </Button>
        </div>

        {selectedCampaign && (
          <p className="text-xs text-muted-foreground">
            Analyserer kampagne: <strong>{selectedCampaign.name}</strong>
          </p>
        )}

        {aiAnswer && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <div className="text-sm">{aiAnswer.answer}</div>
            {aiAnswer.suggestions.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">Forslag til næste skridt:</div>
                <ul className="space-y-1">
                  {aiAnswer.suggestions.map((s, i) => (
                    <li key={i} className="text-xs flex items-start gap-2">
                      <span className="text-primary mt-0.5">→</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
