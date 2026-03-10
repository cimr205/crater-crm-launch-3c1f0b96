import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { api, type CallOutcome } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import CvrSearchInput, { type CvrData } from '@/components/CvrSearchInput';
import { Phone, MessageCircle, MessageSquare } from 'lucide-react';

type LeadRow = {
  id: string;
  name: string;
  email?: string;
  phone: string;
  company?: string;
  status: string;
  leadScore: number;
  source?: string;
  notes?: string;
  createdAt: string;
};

const statusOptions = ['cold', 'contacted', 'qualified', 'customer', 'lost'];

export default function LeadsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState('');
  const [editingStatus, setEditingStatus] = useState('cold');
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadCompany, setNewLeadCompany] = useState('');
  const [newLeadStatus, setNewLeadStatus] = useState('cold');
  const [cvrSearch, setCvrSearch] = useState('');
  const [loggingLead, setLoggingLead] = useState<LeadRow | null>(null);
  const [logOutcome, setLogOutcome] = useState<CallOutcome>('answered');
  const [logDuration, setLogDuration] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [savingLog, setSavingLog] = useState(false);

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
      setLogOutcome('answered');
      setLogDuration('');
      setLogNotes('');
    } catch {
      toast({ title: 'Kunne ikke logge opkald', variant: 'destructive' });
    } finally {
      setSavingLog(false);
    }
  };

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listLeads({
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
        q: query || undefined,
      });
      setLeads(result.data as LeadRow[]);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not load leads', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter, query, toast]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const sources = useMemo(() => {
    const set = new Set(leads.map((lead) => lead.source).filter(Boolean) as string[]);
    return Array.from(set);
  }, [leads]);

  const startEdit = (lead: LeadRow) => {
    setEditingId(lead.id);
    setEditingNotes(lead.notes || '');
    setEditingStatus(lead.status || 'cold');
  };

  const saveEdit = async (leadId: string) => {
    setLoading(true);
    const lead = leads.find((l) => l.id === leadId);
    const prevStatus = lead?.status;
    try {
      await api.updateLead(leadId, {
        status: editingStatus,
        notes: editingNotes,
        lastContactedAt: editingStatus === 'contacted' ? new Date().toISOString() : undefined,
      });
      await loadLeads();
      setEditingId(null);

      // Cross-module: suggest task when lead becomes 'qualified'
      if (prevStatus !== editingStatus && editingStatus === 'qualified' && lead) {
        toast({
          title: `${lead.name} er nu kvalificeret`,
          description: 'Klar til tilbud — opret en salgstask?',
          action: (
            <ToastAction
              altText="Opret salgstask"
              onClick={() => {
                void api.createTask({
                  title: `Send tilbud til ${lead.name}`,
                  priority: 'high',
                  deadline: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
                }).then(() => toast({ title: 'Salgstask oprettet' }))
                  .catch(() => undefined);
              }}
            >
              Opret task
            </ToastAction>
          ),
        });
      } else {
        toast({ title: 'Lead opdateret' });
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not update lead', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const createLead = async () => {
    if (!newLeadName.trim() || !newLeadPhone.trim()) return;
    setLoading(true);
    try {
      await api.createLead({
        name: newLeadName.trim(),
        phone: newLeadPhone.trim(),
        email: newLeadEmail.trim() || undefined,
        company: newLeadCompany.trim() || undefined,
        status: newLeadStatus,
      });
      const createdName = newLeadName.trim();
      setNewLeadName('');
      setNewLeadPhone('');
      setNewLeadEmail('');
      setNewLeadCompany('');
      setNewLeadStatus('cold');
      setCvrSearch('');
      await loadLeads();
      // Cross-module hint: offer quick follow-up task
      toast({
        title: `Lead "${createdName}" oprettet`,
        description: 'Vil du oprette en opfølgningsopgave?',
        action: (
          <ToastAction
            altText="Opret opgave"
            onClick={() => {
              void api.createTodo({
                title: `Følg op på lead: ${createdName}`,
                dueDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
              }).then(() => toast({ title: 'Opfølgningsopgave oprettet' }))
                .catch(() => undefined);
            }}
          >
            Opret opgave
          </ToastAction>
        ),
      });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not create lead', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('crm.leadsTitle')}</h1>
        <Button variant="outline" onClick={() => loadLeads()} disabled={loading}>
          {t('crm.refresh')}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card/70 backdrop-blur p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{t('crm.addLead')}</div>
          <span className="text-xs text-muted-foreground">Hurtigt: skriv CVR → auto-udfyld virksomhedsinfo ↓</span>
        </div>

        {/* CVR quick-fill */}
        <CvrSearchInput
          value={cvrSearch}
          onChange={setCvrSearch}
          onResult={(d: CvrData) => {
            setNewLeadCompany(d.name);
            if (d.phone) setNewLeadPhone(d.phone.replace(/\s/g, ''));
            if (d.email) setNewLeadEmail(d.email);
            // Sæt kontaktpersonens navn til første ejer hvis tilgængeligt
            if (d.owners?.[0]?.name) setNewLeadName(d.owners[0].name);
          }}
          placeholder="Søg via CVR-nummer — auto-udfylder firma, telefon og email fra Virk.dk"
        />

        <div className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder={t('crm.name')}
            value={newLeadName}
            onChange={(event) => setNewLeadName(event.target.value)}
          />
          <Input
            placeholder={t('crm.phone')}
            value={newLeadPhone}
            onChange={(event) => setNewLeadPhone(event.target.value)}
          />
          <Input
            placeholder={t('crm.email')}
            value={newLeadEmail}
            onChange={(event) => setNewLeadEmail(event.target.value)}
          />
          <Input
            placeholder={t('crm.company')}
            value={newLeadCompany}
            onChange={(event) => setNewLeadCompany(event.target.value)}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={newLeadStatus}
            onChange={(event) => setNewLeadStatus(event.target.value)}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <Button onClick={createLead} disabled={loading || !newLeadName.trim() || !newLeadPhone.trim()}>
              {t('crm.saveLead')}
            </Button>
            <div className="text-xs text-muted-foreground">{t('crm.namePhoneRequired')}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Input placeholder={t('crm.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">{t('crm.allStatuses')}</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value)}
        >
          <option value="">{t('crm.allSources')}</option>
          {sources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card/70 backdrop-blur">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('crm.leadsTitle')}</TableHead>
              <TableHead>{t('crm.company')}</TableHead>
              <TableHead>{t('crm.status')}</TableHead>
              <TableHead>{t('crm.score')}</TableHead>
              <TableHead>{t('crm.source')}</TableHead>
              <TableHead>{t('crm.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  {t('crm.empty')}
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{lead.name}</div>
                    <div className="text-xs text-muted-foreground">{lead.email || lead.phone}</div>
                  </TableCell>
                  <TableCell className="text-sm">{lead.company || '—'}</TableCell>
                  <TableCell className="text-sm">{lead.status}</TableCell>
                  <TableCell className="text-sm">{lead.leadScore}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{lead.source || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => startEdit(lead)}>
                        {t('crm.edit')}
                      </Button>
                      {lead.phone && (
                        <>
                          <a href={`tel:${lead.phone}`}>
                            <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700" title={t('phone.callNow')}>
                              <Phone className="h-4 w-4" />
                            </Button>
                          </a>
                          <a
                            href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="ghost" className="text-emerald-600 hover:text-emerald-700" title={t('phone.whatsapp')}>
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          </a>
                          <a href={`sms:${lead.phone}`}>
                            <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700" title={t('phone.sms')}>
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </a>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground text-xs"
                            onClick={() => setLoggingLead(lead)}
                            title={t('phone.logCall')}
                          >
                            + log
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {loggingLead && (
        <div className="rounded-xl border border-border bg-card/70 backdrop-blur p-4 space-y-3">
          <div className="text-sm font-semibold">{t('phone.logCallFor')}: {loggingLead.name} ({loggingLead.phone})</div>
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
              {t('crm.cancel')}
            </Button>
          </div>
        </div>
      )}

      {editingId && (
        <div className="rounded-xl border border-border bg-card/70 backdrop-blur p-4 space-y-3">
          <div className="text-sm font-semibold">{t('crm.updateLead')}</div>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={editingStatus}
              onChange={(event) => setEditingStatus(event.target.value)}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <Button onClick={() => setEditingStatus('contacted')} variant="ghost">
              {t('crm.markContacted')}
            </Button>
          </div>
          <Textarea
            placeholder={t('crm.notes')}
            value={editingNotes}
            onChange={(event) => setEditingNotes(event.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={() => saveEdit(editingId)} disabled={loading}>
              {t('crm.save')}
            </Button>
            <Button variant="ghost" onClick={() => setEditingId(null)}>
              {t('crm.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

