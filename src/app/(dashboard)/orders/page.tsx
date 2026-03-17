'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type OrderType = 'ALL' | 'BUY' | 'SELL';

function formatDate(d: string) {
  return new Date(d).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
}

export default function OrdersPage() {
  const LIMIT = 50;
  const [page, setPage] = useState(1);
  const [type, setType] = useState<OrderType>('ALL');

  const { data } = useQuery({
    queryKey: ['orders', page, type],
    queryFn: () =>
      api.get('/orders', { params: { page, limit: LIMIT, ...(type !== 'ALL' && { type }) } }).then(r => r.data),
  });

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Órdenes</h1>
        <div className="flex gap-2">
          {(['ALL', 'SELL', 'BUY'] as OrderType[]).map(t => (
            <Button
              key={t}
              size="sm"
              variant={type === t ? 'default' : 'outline'}
              onClick={() => { setType(t); setPage(1); }}
            >
              {t}
            </Button>
          ))}
        </div>
      </div>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">Order No</th>
              <th className="px-4 py-3 text-center">Tipo</th>
              <th className="px-4 py-3 text-right">USDT</th>
              <th className="px-4 py-3 text-right">VES</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3 text-left">Método</th>
              <th className="px-4 py-3 text-left">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o: any) => (
              <tr key={o.orderNo} className="border-t hover:bg-muted/20">
                <td className="px-4 py-3 font-mono text-xs">{o.orderNo}</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={o.orderType === 'SELL' ? 'default' : 'secondary'}>{o.orderType}</Badge>
                </td>
                <td className="px-4 py-3 text-right">{Number(o.quantity).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{Number(o.totalPrice).toLocaleString('es-VE', { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 text-right">{Number(o.price).toFixed(2)}</td>
                <td className="px-4 py-3">{o.payMethod}</td>
                <td className="px-4 py-3 text-xs">{formatDate(o.completedAt)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sin órdenes.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button size="sm" variant="outline" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Anterior</Button>
          <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
          <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Siguiente</Button>
        </div>
      )}
    </div>
  );
}
