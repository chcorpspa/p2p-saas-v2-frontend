'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, DollarSign, Clock, X, Calendar, BarChart3 } from 'lucide-react';
import { useSocket } from '@/lib/socket';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PnlSummary {
  closedCycles: number;
  totalNetUsdt: string;
}

interface TradingCycle {
  id: string;
  accountId: string;
  status: 'OPEN' | 'CLOSED' | 'MANUAL_CLOSED';
  sellUsdt: string;
  buyUsdtTotal: string;
  netUsdt: string | null;
  sellFeeUsdt?: string;
  buyFeeUsdt?: string;
  pmFeeUsdt?: string;
  createdAt: string;
  closedAt: string | null;
}

interface MonthlyReport {
  count: number;
  totalNetUsdt: string;
  byMonth?: Array<{ month: string; count: number; totalNetUsdt: string }>;
}

interface Account {
  id: string;
  label: string;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt2(val: string | number | null | undefined): string {
  if (val == null) return '—';
  return Number(val).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmt4(val: string | number | null | undefined): string {
  if (val == null) return '—';
  return Number(val).toLocaleString('es-VE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function SkeletonRow() {
  return (
    <tr className="border-t border-border animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-muted rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

function SummaryCard({ title, value, icon, valueClassName, loading }: {
  title: string; value: string | number; icon: React.ReactNode;
  valueClassName?: string; loading?: boolean;
}) {
  return (
    <div className="glass-card rounded-xl p-5 flex items-center gap-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground truncate">{title}</p>
        {loading ? (
          <div className="h-6 w-24 bg-muted rounded animate-pulse mt-1" />
        ) : (
          <p className={`text-xl font-bold truncate ${valueClassName ?? ''}`}>{value}</p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PnLPage() {
  const qc = useQueryClient();
  const socket = useSocket();

  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [viewTab, setViewTab] = useState<'cycles' | 'monthly' | 'yearly'>('cycles');
  const [closeModal, setCloseModal] = useState<{ cycleId: string } | null>(null);
  const [adjustmentVes, setAdjustmentVes] = useState('');
  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [reportYear, setReportYear] = useState(() => String(new Date().getFullYear()));

  // ── Queries ──
  const { data: summary, isLoading: summaryLoading } = useQuery<PnlSummary>({
    queryKey: ['pnl', 'summary'],
    queryFn: () => api.get('/pnl/summary').then(r => r.data),
  });

  const { data: cycles = [], isLoading: cyclesLoading } = useQuery<TradingCycle[]>({
    queryKey: ['pnl', 'cycles', selectedAccount],
    queryFn: () => {
      const params = selectedAccount ? `?accountId=${selectedAccount}` : '';
      return api.get(`/pnl/cycles${params}`).then(r => r.data);
    },
    enabled: viewTab === 'cycles',
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then(r => r.data),
  });

  const { data: monthlyData, isLoading: monthlyLoading } = useQuery<MonthlyReport>({
    queryKey: ['pnl', 'monthly', reportMonth, selectedAccount],
    queryFn: () => {
      const params = new URLSearchParams({ month: reportMonth });
      if (selectedAccount) params.set('accountId', selectedAccount);
      return api.get(`/pnl/monthly?${params}`).then(r => r.data);
    },
    enabled: viewTab === 'monthly',
  });

  const { data: yearlyData, isLoading: yearlyLoading } = useQuery<MonthlyReport>({
    queryKey: ['pnl', 'yearly', reportYear, selectedAccount],
    queryFn: () => {
      const params = new URLSearchParams({ year: reportYear });
      if (selectedAccount) params.set('accountId', selectedAccount);
      return api.get(`/pnl/yearly?${params}`).then(r => r.data);
    },
    enabled: viewTab === 'yearly',
  });

  // ── Socket invalidation ──
  useEffect(() => {
    if (!socket) return;
    const invalidate = () => { qc.invalidateQueries({ queryKey: ['pnl'] }); };
    socket.on('pnl:update', invalidate);
    socket.on('pnl:cycle_opened', invalidate);
    return () => {
      socket.off('pnl:update', invalidate);
      socket.off('pnl:cycle_opened', invalidate);
    };
  }, [socket, qc]);

  // ── Mutations ──
  const closeCycle = useMutation({
    mutationFn: ({ cycleId, adjustmentVes }: { cycleId: string; adjustmentVes?: number }) =>
      api.post(`/pnl/cycles/${cycleId}/close`, { adjustmentVes }).then(r => r.data),
    onSuccess: () => {
      toast.success('Ciclo cerrado manualmente');
      qc.invalidateQueries({ queryKey: ['pnl'] });
      setCloseModal(null);
      setAdjustmentVes('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Derived ──
  const openCyclesCount = cycles.filter(c => c.status === 'OPEN').length;
  const filteredCycles = statusFilter === 'ALL' ? cycles : cycles.filter(c => c.status === statusFilter || (statusFilter === 'CLOSED' && c.status === 'MANUAL_CLOSED'));
  const totalNetNum = Number(summary?.totalNetUsdt ?? 0);
  const netColor = totalNetNum >= 0 ? 'text-green-400' : 'text-red-400';

  async function exportCsv() {
    const res = await api.get('/pnl/export/csv', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `pnl-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">P&amp;L — Ciclos de Trading</h1>
        <Button variant="outline" size="sm" onClick={exportCsv}>↓ Exportar CSV</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          title="Ciclos Cerrados"
          value={summary?.closedCycles ?? 0}
          icon={<TrendingUp className="w-5 h-5" />}
          loading={summaryLoading}
        />
        <SummaryCard
          title="Ganancia Neta"
          value={`${fmt2(summary?.totalNetUsdt)} USDT`}
          icon={<DollarSign className="w-5 h-5" />}
          valueClassName={netColor}
          loading={summaryLoading}
        />
        <SummaryCard
          title="Ciclos Abiertos"
          value={cyclesLoading ? '—' : openCyclesCount}
          icon={<Clock className="w-5 h-5" />}
          loading={cyclesLoading && !cycles.length}
        />
      </div>

      {/* View tabs + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View tabs */}
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {([
            { key: 'cycles', label: 'Ciclos', icon: <TrendingUp className="w-3.5 h-3.5" /> },
            { key: 'monthly', label: 'Mensual', icon: <Calendar className="w-3.5 h-3.5" /> },
            { key: 'yearly', label: 'Anual', icon: <BarChart3 className="w-3.5 h-3.5" /> },
          ] as const).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setViewTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewTab === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Account select */}
        <select
          value={selectedAccount}
          onChange={e => setSelectedAccount(e.target.value)}
          className="h-9 rounded-lg border border-border bg-card text-foreground text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Todas las cuentas</option>
          {accounts.map(a => (
            <option key={a.id} value={String(a.id)}>{a.label}</option>
          ))}
        </select>

        {/* Status filter — only for cycles tab */}
        {viewTab === 'cycles' && (
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {(['ALL', 'OPEN', 'CLOSED'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {s === 'ALL' ? 'Todos' : s}
              </button>
            ))}
          </div>
        )}

        {/* Month picker */}
        {viewTab === 'monthly' && (
          <input
            type="month"
            value={reportMonth}
            onChange={e => setReportMonth(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card text-foreground text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        )}

        {/* Year picker */}
        {viewTab === 'yearly' && (
          <input
            type="number"
            value={reportYear}
            onChange={e => setReportYear(e.target.value)}
            min="2024"
            max="2030"
            className="h-9 w-24 rounded-lg border border-border bg-card text-foreground text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        )}
      </div>

      {/* ── Cycles Table ─────────────────────────────────────────────── */}
      {viewTab === 'cycles' && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">Apertura</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">Cierre</th>
                  <th className="px-4 py-3 text-right text-muted-foreground font-medium whitespace-nowrap">Venta USDT</th>
                  <th className="px-4 py-3 text-right text-muted-foreground font-medium whitespace-nowrap">Compra USDT</th>
                  <th className="px-4 py-3 text-right text-muted-foreground font-medium whitespace-nowrap">Fees</th>
                  <th className="px-4 py-3 text-right text-muted-foreground font-medium whitespace-nowrap">Neto USDT</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium whitespace-nowrap">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {cyclesLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

                {!cyclesLoading && filteredCycles.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      No hay ciclos registrados.
                    </td>
                  </tr>
                )}

                {!cyclesLoading && filteredCycles.map(c => {
                  const totalFees = Number(c.sellFeeUsdt ?? 0) + Number(c.buyFeeUsdt ?? 0) + Number(c.pmFeeUsdt ?? 0);
                  const netNum = c.netUsdt != null ? Number(c.netUsdt) : null;
                  const netColorRow = netNum == null ? '' : netNum >= 0 ? 'text-green-400' : 'text-red-400';

                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-foreground">{fmtDate(c.createdAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(c.closedAt)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{fmt2(c.sellUsdt)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{fmt2(c.buyUsdtTotal)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums text-muted-foreground">{fmt4(totalFees)}</td>
                      <td className={`px-4 py-3 text-right whitespace-nowrap tabular-nums font-bold ${netColorRow}`}>
                        {c.netUsdt != null ? fmt2(c.netUsdt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={c.status === 'OPEN' ? 'secondary' : 'default'}>
                          {c.status === 'MANUAL_CLOSED' ? 'MANUAL' : c.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.status === 'OPEN' && (
                          <button
                            onClick={() => setCloseModal({ cycleId: c.id })}
                            className="text-xs px-2 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors whitespace-nowrap"
                          >
                            Cerrar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Monthly Report ───────────────────────────────────────────── */}
      {viewTab === 'monthly' && (
        <div className="space-y-4">
          {monthlyLoading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card rounded-xl p-5">
                  <p className="text-sm text-muted-foreground">Ciclos cerrados en {reportMonth}</p>
                  <p className="text-3xl font-bold mt-1">{monthlyData?.count ?? 0}</p>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <p className="text-sm text-muted-foreground">Ganancia neta</p>
                  <p className={`text-3xl font-bold mt-1 ${Number(monthlyData?.totalNetUsdt ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmt2(monthlyData?.totalNetUsdt)} USDT
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Yearly Report ────────────────────────────────────────────── */}
      {viewTab === 'yearly' && (
        <div className="space-y-4">
          {yearlyLoading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card rounded-xl p-5">
                  <p className="text-sm text-muted-foreground">Ciclos en {reportYear}</p>
                  <p className="text-3xl font-bold mt-1">{yearlyData?.count ?? 0}</p>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <p className="text-sm text-muted-foreground">Ganancia anual</p>
                  <p className={`text-3xl font-bold mt-1 ${Number(yearlyData?.totalNetUsdt ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmt2(yearlyData?.totalNetUsdt)} USDT
                  </p>
                </div>
              </div>

              {/* Monthly breakdown */}
              {yearlyData?.byMonth && yearlyData.byMonth.length > 0 && (
                <div className="glass-card rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-3 text-left text-muted-foreground font-medium">Mes</th>
                        <th className="px-4 py-3 text-right text-muted-foreground font-medium">Ciclos</th>
                        <th className="px-4 py-3 text-right text-muted-foreground font-medium">Neto USDT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearlyData.byMonth.map(m => (
                        <tr key={m.month} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3">{m.month}</td>
                          <td className="px-4 py-3 text-right">{m.count}</td>
                          <td className={`px-4 py-3 text-right font-bold ${Number(m.totalNetUsdt) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {fmt2(m.totalNetUsdt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Manual Close Modal ───────────────────────────────────────── */}
      {closeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-5 animate-[fadeInUp_0.2s_ease]">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Cerrar ciclo manualmente</h2>
              <button onClick={() => setCloseModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              El ciclo se cerrará con el total de compras actuales.
              Si el comprador pagó en efectivo, añade el monto VES recibido.
            </p>

            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">
                Ajuste en VES <span className="text-muted-foreground/50">(opcional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={adjustmentVes}
                onChange={e => setAdjustmentVes(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
                placeholder="0.00"
              />
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1 bg-red-600 hover:bg-red-500 text-white"
                onClick={() => {
                  closeCycle.mutate({
                    cycleId: closeModal.cycleId,
                    adjustmentVes: adjustmentVes ? Number(adjustmentVes) : undefined,
                  });
                }}
                disabled={closeCycle.isPending}
              >
                {closeCycle.isPending ? 'Cerrando...' : 'Confirmar cierre'}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setCloseModal(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
