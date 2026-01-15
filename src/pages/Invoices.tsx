import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState } from 'react';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: 'DKK',
  }).format(amount / 100);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Kladde', variant: 'secondary' },
  SENT: { label: 'Sendt', variant: 'default' },
  VIEWED: { label: 'Set', variant: 'outline' },
  OVERDUE: { label: 'Forfalden', variant: 'destructive' },
  COMPLETED: { label: 'Afsluttet', variant: 'default' },
  PAID: { label: 'Betalt', variant: 'default' },
};

export default function Invoices() {
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.getInvoices({ limit: 100 }),
  });

  const invoices = data?.data || [];
  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      invoice.customer?.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Kunne ikke hente fakturaer</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fakturaer</h1>
          <p className="text-muted-foreground mt-1">Administrer dine fakturaer</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Søg fakturaer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-4">
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredInvoices.length ? (
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Fakturanr.</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Kunde</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Dato</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Forfaldsdato</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Beløb</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredInvoices.map((invoice) => {
                    const status = statusConfig[invoice.status] || { label: invoice.status, variant: 'secondary' as const };
                    return (
                      <tr
                        key={invoice.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <td className="p-4">
                          <span className="font-semibold text-foreground">
                            {invoice.invoice_number}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-foreground">
                            {invoice.customer?.name || 'Ukendt'}
                          </span>
                        </td>
                        <td className="p-4">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {formatDate(invoice.invoice_date)}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {formatDate(invoice.due_date)}
                        </td>
                        <td className="p-4 text-right">
                          <span className="font-semibold text-foreground">
                            {formatCurrency(invoice.total)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {search ? 'Ingen fakturaer matcher din søgning' : 'Ingen fakturaer endnu'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
