import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useI18n } from '@/lib/i18n';
import { api, type WebhookChannel, type WebhookSubscription } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Webhook, Plus, Trash2, Send, Copy, Loader2 } from 'lucide-react';

const CHANNEL_PLACEHOLDERS: Record<WebhookChannel, string> = {
  generic: 'https://hooks.zapier.com/hooks/catch/...',
  slack: 'https://hooks.slack.com/services/...',
  teams: 'https://outlook.office.com/webhook/...',
};

export default function WebhooksPage() {
  const { t } = useI18n();
  const { toast } = useToast();

  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [newChannel, setNewChannel] = useState<WebhookChannel>('generic');
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.listWebhooks(), api.getWebhookEvents()])
      .then(([webhooksRes, eventsRes]) => {
        setWebhooks(webhooksRes);
        setEvents(eventsRes);
      })
      .catch((err) => toast({ title: err.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleEvent = (event: string) => {
    setNewEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));
  };

  const handleCreate = () => {
    if (!newUrl.trim() || newEvents.length === 0) return;
    setCreating(true);
    api
      .createWebhook({ url: newUrl.trim(), events: newEvents, channel: newChannel })
      .then((sub) => {
        setWebhooks((prev) => [sub, ...prev]);
        if (sub.secret) setRevealedSecret({ id: sub.id, secret: sub.secret });
        setDialogOpen(false);
        setNewUrl('');
        setNewEvents([]);
        setNewChannel('generic');
        toast({ title: t('webhooks.created') });
      })
      .catch((err) => toast({ title: err.message, variant: 'destructive' }))
      .finally(() => setCreating(false));
  };

  const handleToggleActive = (sub: WebhookSubscription) => {
    api
      .updateWebhook(sub.id, { is_active: !sub.is_active })
      .then((updated) => setWebhooks((prev) => prev.map((w) => (w.id === sub.id ? updated : w))))
      .catch((err) => toast({ title: err.message, variant: 'destructive' }));
  };

  const handleDelete = (sub: WebhookSubscription) => {
    api
      .deleteWebhook(sub.id)
      .then(() => setWebhooks((prev) => prev.filter((w) => w.id !== sub.id)))
      .catch((err) => toast({ title: err.message, variant: 'destructive' }));
  };

  const handleTest = (sub: WebhookSubscription) => {
    setTestingId(sub.id);
    api
      .testWebhook(sub.id)
      .then(() => toast({ title: t('webhooks.testSent') }))
      .catch((err) => toast({ title: err.message, variant: 'destructive' }))
      .finally(() => setTestingId(null));
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast({ title: t('webhooks.secretCopied') });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('webhooks.title')}</h1>
          <p className="text-muted-foreground">{t('webhooks.subtitle')}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('webhooks.add')}
        </Button>
      </div>

      {revealedSecret && (
        <Card className="p-4 border-primary/40 bg-primary/5 space-y-2">
          <p className="text-sm font-medium">{t('webhooks.secretRevealTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('webhooks.secretRevealHint')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm break-all">{revealedSecret.secret}</code>
            <Button size="sm" variant="outline" onClick={() => copySecret(revealedSecret.secret)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setRevealedSecret(null)}>
            {t('webhooks.secretRevealDismiss')}
          </Button>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : webhooks.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <Webhook className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">{t('webhooks.emptyTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('webhooks.emptyHint')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((sub) => (
            <Card key={sub.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium break-all">{sub.url}</p>
                    {sub.channel !== 'generic' && (
                      <Badge variant="outline" className="capitalize shrink-0">{sub.channel}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('webhooks.secret')}: {sub.secret_preview}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={sub.is_active} onCheckedChange={() => handleToggleActive(sub)} />
                  <Button size="icon" variant="ghost" onClick={() => handleTest(sub)} disabled={testingId === sub.id}>
                    {testingId === sub.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(sub)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sub.events.map((event) => (
                  <Badge key={event} variant="secondary">{event}</Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('webhooks.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('webhooks.channelLabel')}</label>
              <Select value={newChannel} onValueChange={(v) => setNewChannel(v as WebhookChannel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generic">{t('webhooks.channelGeneric')}</SelectItem>
                  <SelectItem value="slack">{t('webhooks.channelSlack')}</SelectItem>
                  <SelectItem value="teams">{t('webhooks.channelTeams')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('webhooks.urlLabel')}</label>
              <Input
                placeholder={CHANNEL_PLACEHOLDERS[newChannel]}
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('webhooks.eventsLabel')}</label>
              <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                {events.map((event) => (
                  <label key={event} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={newEvents.includes(event)} onCheckedChange={() => toggleEvent(event)} />
                    {event}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={creating || !newUrl.trim() || newEvents.length === 0}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('webhooks.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
