import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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

export default function Payments() {
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['payments'],
    queryFn: () => api.getPayments({ limit: 100 }),
  });

  const payments = data?.data || [];
  const filteredPayments = payments.filter(
    (payment) =>
      payment.payment_number?.toLowerCase().includes(search.toLowerCase()) ||
      payment.customer?.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Kunne ikke hente betalinger</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Betalinger</h1>
          <p className="text-muted-foreground mt-1">Oversigt over betalinger</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Søg betalinger..."
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
      ) : filteredPayments.length ? (
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-muted-foreground">Betalingsnr.</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Kunde</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Faktura</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Dato</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Metode</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Beløb</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="p-4">
                        <span className="font-semibold text-foreground">
                          {payment.payment_number}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-foreground">
                          {payment.customer?.name || 'Ukendt'}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {payment.invoice?.invoice_number || '-'}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {formatDate(payment.payment_date)}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {payment.payment_method || '-'}
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-semibold text-green-600">
                          {formatCurrency(payment.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {search ? 'Ingen betalinger matcher din søgning' : 'Ingen betalinger endnu'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
