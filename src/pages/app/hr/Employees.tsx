import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { UserSquare2, Plus, RefreshCw, Mail, Shield, Users, Crown, X, Copy, Check } from 'lucide-react';

type CompanyUser = {
  id: string;
  role: string;
  email: string;
  full_name: string | null;
  created_at: string;
};

type RoleOption = {
  slug: string;
  label: string;
};

const ROLE_COLORS: Record<string, string> = {
  global_admin: 'bg-amber-500/15 text-amber-400',
  admin:        'bg-primary/15 text-primary',
  manager:      'bg-violet-500/15 text-violet-400',
  employee:     'bg-muted text-muted-foreground',
  user:         'bg-muted text-muted-foreground',
};

function initials(u: CompanyUser) {
  const name = u.full_name || u.email;
  return name.split(/[\s@]/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function EmployeesPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  // Invite
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'user'>('user');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [companyUsers, availableRoles] = await Promise.all([api.getCompanyUsers(), api.getRoles()]);
      setUsers(companyUsers);
      setRoles(availableRoles.map((r) => ({ slug: r.slug, label: r.label })));
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Kunne ikke hente medarbejdere', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const updateRole = async (userId: string, role: string) => {
    setBusyUserId(userId);
    try {
      await api.updateCompanyUserRole(userId, role);
      await load();
      toast({ title: 'Rolle opdateret' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Kunne ikke opdatere rolle', variant: 'destructive' });
    } finally {
      setBusyUserId(null);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({ title: 'Email er påkrævet', variant: 'destructive' });
      return;
    }
    setInviting(true);
    try {
      const res = await api.createInvitation(inviteEmail.trim(), inviteRole);
      const link = `${window.location.origin}/en/auth/join-company?token=${res.token}`;
      setInviteLink(link);
      toast({ title: `Invitation sendt til ${inviteEmail}` });
      setInviteEmail('');
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Kunne ikke sende invitation', variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const admins = users.filter(u => u.role === 'admin' || u.role === 'global_admin').length;
  const managers = users.filter(u => u.role === 'manager').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('hr.employeesTitle')}</h1>
          <p className="text-sm text-muted-foreground">Administrer teammedlemmer og roller</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowInvite(!showInvite)} className="gap-2">
            {showInvite ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showInvite ? 'Luk' : 'Inviter medarbejder'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Teammedlemmer', value: users.length, color: 'text-primary' },
          { icon: Crown, label: 'Admins', value: admins, color: 'text-amber-400' },
          { icon: Shield, label: 'Managere', value: managers, color: 'text-violet-400' },
          { icon: UserSquare2, label: 'Medarbejdere', value: users.length - admins - managers, color: 'text-muted-foreground' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5">
            <s.icon className={`h-4 w-4 mb-3 ${s.color}`} />
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-semibold">Inviter nyt teammedlem</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Email *</label>
              <Input
                type="email"
                placeholder="medarbejder@virksomhed.dk"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendInvite()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Rolle</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'admin' | 'user')}
              >
                <option value="user">Medarbejder</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}>
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              {inviting ? 'Sender...' : 'Send invitation'}
            </Button>
            <Button variant="outline" onClick={() => { setShowInvite(false); setInviteLink(''); }}>
              Annuller
            </Button>
          </div>

          {inviteLink && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs font-mono text-muted-foreground flex-1 truncate">{inviteLink}</p>
              <Button size="sm" variant="outline" onClick={copyLink} className="h-7 gap-1.5 shrink-0">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Kopieret' : 'Kopiér'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Employee list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />Indlæser...
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center rounded-xl border border-border bg-card">
          <UserSquare2 className="h-10 w-10 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">{t('hr.empty')}</p>
          <Button onClick={() => setShowInvite(true)}>{t('hr.addEmployee')}</Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-sm">Teammedlemmer ({users.length})</h3>
          </div>
          <div className="divide-y divide-border">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-[12px] font-semibold text-primary">{initials(user)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{user.full_name || '—'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={user.role}
                    onChange={(e) => updateRole(user.id, e.target.value)}
                    disabled={busyUserId === user.id}
                  >
                    {roles.map((r) => (
                      <option key={r.slug} value={r.slug}>{r.label}</option>
                    ))}
                  </select>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${ROLE_COLORS[user.role] ?? 'bg-muted text-muted-foreground'}`}>
                    {user.role}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground/60 hidden md:block">
                    {new Date(user.created_at).toLocaleDateString('da-DK')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
