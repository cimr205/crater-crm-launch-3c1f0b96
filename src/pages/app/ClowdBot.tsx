import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';

const providers = [
  { id: 'apollo', label: 'Apollo', authType: 'api_key', placeholder: 'Apollo API key' },
  { id: 'google_places', label: 'Google Places', authType: 'api_key', placeholder: 'Google Places API key' },
  { id: 'hubspot', label: 'HubSpot', authType: 'oauth', placeholder: 'HubSpot access token' },
  { id: 'salesforce', label: 'Salesforce', authType: 'oauth', placeholder: 'Salesforce access token' },
  { id: 'hunter', label: 'Hunter.io', authType: 'api_key', placeholder: 'Hunter API key' },
  { id: 'clearbit', label: 'Clearbit', authType: 'api_key', placeholder: 'Clearbit API key' },
];

export default function ClowdBotPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [status, setStatus] = useState<null | { jobs: number; active_jobs: number }>(null);
  const [integrations, setIntegrations] = useState<Array<{ provider: string; status: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [instanceUrls, setInstanceUrls] = useState<Record<string, string>>({});

  type Job = { id: string; name: string; status: 'active' | 'paused' } & Record<string, unknown>;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobName, setJobName] = useState('');
  const [jobKeywords, setJobKeywords] = useState('');
  const [jobIndustries, setJobIndustries] = useState('');
  const [jobCountries, setJobCountries] = useState('');
  const [jobLocations, setJobLocations] = useState('');
  const [jobRoles, setJobRoles] = useState('');
  const [jobCompanySize, setJobCompanySize] = useState('');
  const [jobInterval, setJobInterval] = useState('30');
  const [jobDeliverHour, setJobDeliverHour] = useState('8');
  const [jobTimezone, setJobTimezone] = useState('Europe/Copenhagen');
  const [jobSources, setJobSources] = useState<Record<string, boolean>>({
    apollo: true,
    google_places: true,
    hubspot: false,
    salesforce: false,
    hunter: true,
    clearbit: true,
  });

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [statusRes, integrationsRes, jobsRes] = await Promise.all([
        api.getClowdBotStatus(),
        api.listClowdBotIntegrations(),
        api.listClowdBotJobs(),
      ]);
      setStatus(statusRes.totals);
      setIntegrations(integrationsRes.data);
      setJobs(jobsRes.data as Job[]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load ClowdBot data');
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadData().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [loadData]);

  const integrationStatus = useMemo(() => {
    const map: Record<string, string> = {};
    integrations.forEach((item) => {
      map[item.provider] = item.status;
    });
    return map;
  }, [integrations]);

  const handleConnect = async (provider: string, authType: 'api_key' | 'oauth' | 'token') => {
    setLoading(true);
    try {
      await api.connectClowdBotIntegration({
        provider,
        authType,
        apiKey: keys[provider],
        accessToken: keys[provider],
        instanceUrl: instanceUrls[provider],
      });
      await loadData();
      toast({ title: 'Integration connected' });
    } catch (error) {
      toast({ title: (error as Error).message || 'Integration failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (provider: string) => {
    setLoading(true);
    try {
      await api.removeClowdBotIntegration(provider);
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async () => {
    if (!jobName.trim()) return;
    setLoading(true);
    try {
      const sources = Object.entries(jobSources)
        .filter(([, value]) => value)
        .map(([key]) => key);
      await api.createClowdBotJob({
        name: jobName,
        keywords: jobKeywords.split(',').map((v) => v.trim()).filter(Boolean),
        industries: jobIndustries.split(',').map((v) => v.trim()).filter(Boolean),
        countries: jobCountries.split(',').map((v) => v.trim()).filter(Boolean),
        locations: jobLocations.split(',').map((v) => v.trim()).filter(Boolean),
        roles: jobRoles.split(',').map((v) => v.trim()).filter(Boolean),
        companySize: jobCompanySize || undefined,
        sources,
        intervalMinutes: Number(jobInterval) || 30,
        deliverHour: Number(jobDeliverHour) || 8,
        deliverTimezone: jobTimezone || 'Europe/Copenhagen',
      });
      setJobName('');
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleRunJob = async (jobId: string) => {
    setLoading(true);
    try {
      await api.runClowdBotJob(jobId);
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleToggleJob = async (jobId: string, status: 'active' | 'paused') => {
    setLoading(true);
    try {
      await api.updateClowdBotJob(jobId, { status });
      await loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleMetaSync = async () => {
    setLoading(true);
    try {
      await api.syncMetaLeads();
      toast({ title: 'Meta leads synced' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ClowdBot</h1>
        <p className="text-sm text-muted-foreground">Automated lead generation + Meta Lead Ads intake</p>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      <Card className="p-6 space-y-2 bg-card/70 backdrop-blur border-border">
        <div className="text-sm font-semibold">Status</div>
        <div className="text-sm text-muted-foreground">
          Jobs: {status?.jobs ?? '—'} · Active: {status?.active_jobs ?? '—'}
        </div>
        <Button variant="outline" onClick={handleMetaSync} disabled={loading}>
          Sync Meta Leads
        </Button>
      </Card>

      <Card className="p-6 space-y-4 bg-card/70 backdrop-blur border-border">
        <div>
          <div className="text-sm font-semibold">Integrations</div>
          <div className="text-xs text-muted-foreground">Connect your own data sources</div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {providers.map((provider) => {
            const statusLabel = integrationStatus[provider.id] || 'disconnected';
            return (
              <div key={provider.id} className="space-y-2 rounded-md border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{provider.label}</div>
                  <div className="text-xs text-muted-foreground">{statusLabel}</div>
                </div>
                <Input
                  placeholder={provider.placeholder}
                  value={keys[provider.id] || ''}
                  onChange={(event) => setKeys((prev) => ({ ...prev, [provider.id]: event.target.value }))}
                />
                {provider.id === 'salesforce' && (
                  <Input
                    placeholder="Salesforce instance URL"
                    value={instanceUrls[provider.id] || ''}
                    onChange={(event) =>
                      setInstanceUrls((prev) => ({ ...prev, [provider.id]: event.target.value }))
                    }
                  />
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleConnect(provider.id, provider.authType as 'api_key' | 'oauth' | 'token')}
                    disabled={loading}
                  >
                    Connect
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleRemove(provider.id)} disabled={loading}>
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6 space-y-4 bg-card/70 backdrop-blur border-border">
        <div>
          <div className="text-sm font-semibold">Create search job</div>
          <div className="text-xs text-muted-foreground">
            Configure what ClowdBot should find and deliver by 08:00.
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input placeholder="Job name" value={jobName} onChange={(event) => setJobName(event.target.value)} />
          <Input
            placeholder="Keywords (comma separated)"
            value={jobKeywords}
            onChange={(event) => setJobKeywords(event.target.value)}
          />
          <Input
            placeholder="Industries"
            value={jobIndustries}
            onChange={(event) => setJobIndustries(event.target.value)}
          />
          <Input
            placeholder="Countries"
            value={jobCountries}
            onChange={(event) => setJobCountries(event.target.value)}
          />
          <Input
            placeholder="Locations"
            value={jobLocations}
            onChange={(event) => setJobLocations(event.target.value)}
          />
          <Input placeholder="Roles" value={jobRoles} onChange={(event) => setJobRoles(event.target.value)} />
          <Input
            placeholder="Company size"
            value={jobCompanySize}
            onChange={(event) => setJobCompanySize(event.target.value)}
          />
          <Input
            placeholder="Interval minutes"
            value={jobInterval}
            onChange={(event) => setJobInterval(event.target.value)}
          />
          <Input
            placeholder="Deliver hour (0-23)"
            value={jobDeliverHour}
            onChange={(event) => setJobDeliverHour(event.target.value)}
          />
          <Input
            placeholder="Timezone"
            value={jobTimezone}
            onChange={(event) => setJobTimezone(event.target.value)}
          />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {Object.keys(jobSources).map((source) => (
            <label key={source} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={jobSources[source]}
                onChange={(event) =>
                  setJobSources((prev) => ({ ...prev, [source]: event.target.checked }))
                }
              />
              {source}
            </label>
          ))}
        </div>
        <Button onClick={handleCreateJob} disabled={loading}>
          Create job
        </Button>
      </Card>

      <Card className="p-6 space-y-3 bg-card/70 backdrop-blur border-border">
        <div className="text-sm font-semibold">Jobs</div>
        {jobs.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t('crm.empty')}</div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">{job.name}</div>
                  <div className="text-xs text-muted-foreground">Status: {job.status}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleRunJob(job.id)} disabled={loading}>
                    Run now
                  </Button>
                  {job.status === 'active' ? (
                    <Button size="sm" variant="ghost" onClick={() => handleToggleJob(job.id, 'paused')} disabled={loading}>
                      Pause
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => handleToggleJob(job.id, 'active')} disabled={loading}>
                      Resume
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

