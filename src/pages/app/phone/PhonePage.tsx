import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { api, type CallLog, type CallOutcome } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Phone, MessageCircle, MessageSquare, Info, Trash2 } from 'lucide-react';

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  company?: string;
  status: string;
};

const outcomeColors: Record<CallOutcome, string> = {
  answered: 'text-green-600',
  no_answer: 'text-yellow-600',
  voicemail: 'text-blue-600',
  busy: 'text-orange-600',
  failed: 'text-red-600',
};

export default function PhonePage() {
  const { t } = useI18n();
  const { toast } = useToast();

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Log-call form
  const [loggingLead, setLoggingLead] = useState<LeadRow | null>(null);
  const [logOutcome, setLogOutcome] = useState<CallOutcome>('answered');
  const [logDuration, setLogDuration] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  const loadLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const result = await api.listLeads({ status: 'cold' });
      const coldLeads = (result.data as LeadRow[]).filter((l) => l.phone);
      // also load contacted leads without phone filter
      const result2 = await api.listLeads({ status: 'contacted' });
      const contactedLeads = (result2.data as LeadRow[]).filter((l) => l.phone);
      setLeads([...coldLeads, ...contactedLeads]);
    } catch {
      // silently show empty
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const result = await api.listCallLogs({ limit: 50 });
      setCallLogs(result.data.calls ?? []);
    } catch {
      setCallLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
    void loadLogs();
  }, [loadLeads, loadLogs]);

  const openLogForm = (lead: LeadRow) => {
    setLoggingLead(lead);
    setLogOutcome('answered');
    setLogDuration('');
    setLogNotes('');
  };

  const saveCallLog = async () => {
    if (!loggingLead) return;
    setSavingLog(true);
    try {
      await api.logCall({
        lead_id: loggingLead.id,
        to_number: loggingLead.phone,
        outcome: logOutcome,
        duration_seconds: logDuration ? Number(logDuration) : undefined,
        notes: logNotes || undefined,
      });
      toast({ title: `Opkald til ${loggingLead.name} logget` });
      setLoggingLead(null);
      void loadLogs();
    } catch {
      toast({ title: 'Kunne ikke logge opkald', variant: 'destructive' });
    } finally {
      setSavingLog(false);
    }
  };

  const deleteLog = async (id: string) => {
    try {
      await api.deleteCallLog(id);
      setCallLogs((prev) => prev.filter((l) => l.id !== id));
    } catch {
      toast({ title: 'Kunne ikke slette log', variant: 'destructive' });
    }
  };

  const formatDuration = (secs?: number) => {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('phone.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('phone.subtitle')}</p>
      </div>

      {/* How it works banner */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-blue-800 dark:text-blue-200">{t('phone.howItWorks')}</div>
            <div className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">{t('phone.howItWorksBody')}</div>
          </div>
        </div>
      </Card>

      {/* Cold call queue */}
      <Card className="p-6 space-y-4 bg-card/70 backdrop-blur border-border">
        <div>
          <h2 className="text-base font-semibold">{t('phone.callQueue')}</h2>
          <p className="text-sm text-muted-foreground">{t('phone.callQueueSubtitle')}</p>
        </div>

        {loadingLeads ? (
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : leads.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">{t('phone.queueEmpty')}</div>
        ) : (
          <div className="space-y-2">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium">{lead.name}</div>
                  <div className="text-xs text-muted-foreground">{lead.phone}{lead.company ? ` · ${lead.company}` : ''}</div>
                </div>
                <div className="flex items-center gap-1">
                  <a href={`tel:${lead.phone}`}>
                    <Button size="sm" variant="outline" className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50">
                      <Phone className="h-3.5 w-3.5" />
                      {t('phone.callNow')}
                    </Button>
                  </a>
                  <a
                    href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline" className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {t('phone.whatsapp')}
                    </Button>
                  </a>
                  <a href={`sms:${lead.phone}`}>
                    <Button size="sm" variant="ghost" className="text-blue-600" title={t('phone.sms')}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-muted-foreground"
                    onClick={() => openLogForm(lead)}
                  >
                    + {t('phone.logCall')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Log call form */}
        {loggingLead && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="text-sm font-semibold">{t('phone.logCallFor')}: {loggingLead.name}</div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">{t('phone.outcome')}</div>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={logOutcome}
                  onChange={(e) => setLogOutcome(e.target.value as CallOutcome)}
                >
                  <option value="answered">{t('phone.answered')}</option>
                  <option value="no_answer">{t('phone.no_answer')}</option>
                  <option value="voicemail">{t('phone.voicemail')}</option>
                  <option value="busy">{t('phone.busy')}</option>
                  <option value="failed">{t('phone.failed')}</option>
                </select>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">{t('phone.duration')}</div>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={logDuration}
                  onChange={(e) => setLogDuration(e.target.value)}
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">{t('phone.notes')}</div>
                <Input
                  placeholder={t('phone.notes')}
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveCallLog} disabled={savingLog}>
                {savingLog ? t('common.loading') : t('phone.saveLog')}
              </Button>
              <Button variant="ghost" onClick={() => setLoggingLead(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Call log */}
      <Card className="p-6 space-y-4 bg-card/70 backdrop-blur border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('phone.callLog')}</h2>
          <Button variant="outline" size="sm" onClick={() => { void loadLogs(); }}>
            {t('crm.refresh')}
          </Button>
        </div>

        {loadingLogs ? (
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : callLogs.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">{t('phone.callLogEmpty')}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('phone.col.lead')}</TableHead>
                <TableHead>{t('phone.col.phone')}</TableHead>
                <TableHead>{t('phone.col.outcome')}</TableHead>
                <TableHead>{t('phone.col.duration')}</TableHead>
                <TableHead>{t('phone.col.notes')}</TableHead>
                <TableHead>{t('phone.col.date')}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {callLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm font-medium">{log.lead_name || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.to_number}</TableCell>
                  <TableCell>
                    <span className={`text-sm font-medium ${outcomeColors[log.outcome]}`}>
                      {t(`phone.${log.outcome}`)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDuration(log.duration_seconds)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{log.notes || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void deleteLog(log.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
