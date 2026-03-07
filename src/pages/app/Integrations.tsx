import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

type Provider = { id: string; label: string; supportsOAuth: boolean };
type Connection = { provider: string; connectedAt: string; updatedAt: string };

function openCenteredPopup(url: string, title: string) {
  const width = 520;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  return window.open(
    url,
    title,
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await api.listIntegrationProviders();
      setProviders(result.providers);
      setConnections(result.connections);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load integrations');
    }
  }, []);

  useEffect(() => {
    loadData();
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'integration:connected') {
        loadData().catch(() => undefined);
        toast({ title: 'Integration connected' });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadData, toast]);

  const connectedMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    connections.forEach((conn) => {
      map[conn.provider] = true;
    });
    return map;
  }, [connections]);

  const handleConnect = async (providerId: string) => {
    setLoading(true);
    try {
      const authUrl = api.getIntegrationAuthUrl(providerId);
      if (authUrl) {
        openCenteredPopup(authUrl, `Connect ${providerId}`);
      } else {
        toast({ title: 'Not authenticated' });
      }
    } catch (error) {
      toast({ title: (error as Error).message || 'Connect failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    setLoading(true);
    try {
      await api.disconnectIntegration(providerId);
      await loadData();
      toast({ title: 'Integration disconnected' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Disconnect failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">Connect external services via OAuth popup.</p>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => {
          const connected = Boolean(connectedMap[provider.id]);
          return (
            <Card key={provider.id} className="p-5 space-y-3 bg-card/70 backdrop-blur border-border">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{provider.label}</div>
                <div className="text-xs text-muted-foreground">
                  {connected ? 'Connected' : provider.supportsOAuth ? 'Not connected' : 'Coming soon'}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleConnect(provider.id)}
                  disabled={!provider.supportsOAuth || loading || connected}
                >
                  Connect
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDisconnect(provider.id)}
                  disabled={!connected || loading}
                >
                  Disconnect
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

