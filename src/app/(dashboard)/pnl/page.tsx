'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSocket } from '@/lib/socket';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';

function formatUsdt(val: string | number) {
  return Number(val).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PnLPage() {
  const qc = useQueryClient();
  const socket = useSocket();

  const { data } = useQuery({
    queryKey: ['pnl'],
    queryFn: () => api.get('/pnl/cycles').then(r => r.data),
  });

  const cycles = data?.cycles ?? [];
  const totalNet = data?.totalNet ?? cycles.reduce((acc: number, c: any) => acc + Number(c.netUsdt ?? 0), 0);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = () => qc.invalidateQueries({ queryKey: ['pnl'] });
    socket.on('pnl:cycle_opened', onUpdate);
    socket.on('pnl:update', onUpdate);
    return () => {
      socket.off('pnl:cycle_opened', onUpdate);
      socket.off('pnl:update', onUpdate);
    };
  }, [socket, qc]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">P&amp;L</h1>
        <div className={`text-lg font-semibold ${totalNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          Total Neto: {formatUsdt(totalNet)} USDT
        </div>
      </div>
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-right">Venta USDT</th>
              <th className="px-4 py-3 text-right">Compra USDT</th>
              <th className="px-4 py-3 text-right">Neto USDT</th>
              <th className="px-4 py-3 text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cycles.map((c: any) => (
              <tr key={c.id} className="border-t hover:bg-muted/20">
                <td className="px-4 py-3">{new Date(c.createdAt).toLocaleDateString('es-VE')}</td>
                <td className="px-4 py-3 text-right">{formatUsdt(c.sellUsdt)}</td>
                <td className="px-4 py-3 text-right">{formatUsdt(c.buyUsdtTotal)}</td>
                <td className={`px-4 py-3 text-right font-medium ${Number(c.netUsdt ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {c.netUsdt != null ? formatUsdt(c.netUsdt) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={c.status === 'CLOSED' ? 'default' : 'secondary'}>{c.status}</Badge>
                </td>
              </tr>
            ))}
            {cycles.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No hay ciclos registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
