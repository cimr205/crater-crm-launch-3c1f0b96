import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type StatCard = {
  title: string;
  value: string;
  change?: string;
};

export default function StatCards({ items }: { items: StatCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.title} className="bg-card/70 backdrop-blur border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{item.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{item.value}</div>
            {item.change && <div className="text-xs text-muted-foreground mt-1">{item.change}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}




