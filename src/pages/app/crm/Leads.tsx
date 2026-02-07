import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listLeads({
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
        q: query || undefined,
      });
      setLeads(result.data as LeadRow[]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter, query]);

  useEffect(() => {
    loadLeads().catch(() => undefined);
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
    try {
      await api.updateLead(leadId, {
        status: editingStatus,
        notes: editingNotes,
        lastContactedAt: editingStatus === 'contacted' ? new Date().toISOString() : undefined,
      });
      await loadLeads();
      setEditingId(null);
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
      setNewLeadName('');
      setNewLeadPhone('');
      setNewLeadEmail('');
      setNewLeadCompany('');
      setNewLeadStatus('cold');
      await loadLeads();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('crm.leadsTitle')}</h1>
        <Button variant="outline" onClick={() => loadLeads()} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card/70 backdrop-blur p-4 space-y-3">
        <div className="text-sm font-semibold">Add lead</div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="Name"
            value={newLeadName}
            onChange={(event) => setNewLeadName(event.target.value)}
          />
          <Input
            placeholder="Phone"
            value={newLeadPhone}
            onChange={(event) => setNewLeadPhone(event.target.value)}
          />
          <Input
            placeholder="Email"
            value={newLeadEmail}
            onChange={(event) => setNewLeadEmail(event.target.value)}
          />
          <Input
            placeholder="Company"
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
              Save lead
            </Button>
            <div className="text-xs text-muted-foreground">Name + phone required</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Input placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All statuses</option>
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
          <option value="">All sources</option>
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
              <TableHead>Company</TableHead>
              <TableHead>{t('crm.status')}</TableHead>
              <TableHead>{t('crm.score')}</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Actions</TableHead>
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
                    <Button size="sm" variant="outline" onClick={() => startEdit(lead)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editingId && (
        <div className="rounded-xl border border-border bg-card/70 backdrop-blur p-4 space-y-3">
          <div className="text-sm font-semibold">Update lead</div>
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
              Mark contacted
            </Button>
          </div>
          <Textarea
            placeholder="Notes"
            value={editingNotes}
            onChange={(event) => setEditingNotes(event.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={() => saveEdit(editingId)} disabled={loading}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

