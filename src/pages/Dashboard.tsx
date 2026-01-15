import { useQuery } from '@tanstack/react-query';
import { api, DashboardData } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, FileText, CreditCard, TrendingUp } from 'lucide-react';

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

export default function Dashboard() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(),
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Kunne ikke hente dashboard data</p>
      </div>
    );
  }

  const stats = [
    {
      title: 'Kunder',
      value: data?.total_customers ?? 0,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Fakturaer',
      value: data?.total_invoices ?? 0,
      icon: FileText,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Udestående',
      value: formatCurrency(data?.total_amount_due ?? 0),
      icon: CreditCard,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Betalt',
      value: formatCurrency(data?.total_paid ?? 0),
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Oversigt over din virksomhed</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {stat.value}
                    </p>
                  )}
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Seneste fakturaer</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.recent_invoices?.length ? (
              <div className="space-y-3">
                {data.recent_invoices.slice(0, 5).map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium text-foreground">{invoice.invoice_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.customer?.name || 'Ukendt kunde'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {formatCurrency(invoice.total)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(invoice.invoice_date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-6">Ingen fakturaer endnu</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Customers */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Seneste kunder</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.recent_customers?.length ? (
              <div className="space-y-3">
                {data.recent_customers.slice(0, 5).map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {customer.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{customer.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{customer.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-6">Ingen kunder endnu</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
