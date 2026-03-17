'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, DollarSign, Clock } from 'lucide-react';
import { useSocket } from '@/lib/socket';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PnlSummary {
  closedCycles: number;
  totalNetUsdt: string;
}

interface TradingCycle {
  id: number;
  accountId: number;
  status: 'OPEN' | 'CLOSED';
  sellUsdt: string;
  buyUsdtTotal: string;
  netUsdt: string | null;
  sellVes: string;
  buyVesTotal: string;
  sellFeeUsdt: string;
  buyFeeUsdt: string;
  pmFeeUsdt: string;
  createdAt: string;
  closedAt: string | null;
}

interface Account {
  id: number;
  label: string;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt2(val: string | number | null | undefined): string {
  if (val == null) return '—';
  return Number(val).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmt4(val: string | number | null | undefined): string {
  if (val == null) return '—';
  return Number(val).toLocaleString('es-VE', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
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

// ─── Skeleton row ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-t border-border animate-pulse">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-muted rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  valueClassName?: string;
  loading?: boolean;
}

function SummaryCard({ title, value, icon, valueClassName, loading }: SummaryCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
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

  // ── Queries ──
  const { data: summary, isLoading: summaryLoading } = useQuery<PnlSummary>({
    queryKey: ['pnl', 'summary'],
    queryFn: () => api.get('/pnl/summary').then((r) => r.data),
  });

  const { data: cycles = [], isLoading: cyclesLoading } = useQuery<TradingCycle[]>({
    queryKey: ['pnl', 'cycles', selectedAccount],
    queryFn: () => {
      const params = selectedAccount ? `?accountId=${selectedAccount}` : '';
      return api.get(`/pnl/cycles${params}`).then((r) => r.data);
    },
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then((r) => r.data),
  });

  // ── Socket invalidation ──
  useEffect(() => {
    if (!socket) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ['pnl'] });
    };
    socket.on('pnl:update', invalidate);
    socket.on('pnl:cycle_opened', invalidate);
    return () => {
      socket.off('pnl:update', invalidate);
      socket.off('pnl:cycle_opened', invalidate);
    };
  }, [socket, qc]);

  // ── Derived ──
  const openCyclesCount = cycles.filter((c) => c.status === 'OPEN').length;

  const filteredCycles =
    statusFilter === 'ALL'
      ? cycles
      : cycles.filter((c) => c.status === statusFilter);

  const totalNetNum = Number(summary?.totalNetUsdt ?? 0);
  const netColor = totalNetNum >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="p-6 space-y-6">
      {/* Page title */}
      <h1 className="text-2xl font-bold">P&amp;L — Ciclos de Trading</h1>

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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Account select */}
        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="h-9 rounded-lg border border-border bg-card text-foreground text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Todas las cuentas</option>
          {accounts.map((a) => (
            <option key={a.id} value={String(a.id)}>
              {a.label}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {(['ALL', 'OPEN', 'CLOSED'] as const).map((s) => (
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
      </div>

      {/* Cycles Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">
                  Fecha Apertura
                </th>
                <th className="px-4 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">
                  Fecha Cierre
                </th>
                <th className="px-4 py-3 text-right text-muted-foreground font-medium whitespace-nowrap">
                  Venta USDT
                </th>
                <th className="px-4 py-3 text-right text-muted-foreground font-medium whitespace-nowrap">
                  Compra USDT
                </th>
                <th className="px-4 py-3 text-right text-muted-foreground font-medium whitespace-nowrap">
                  Fees
                </th>
                <th className="px-4 py-3 text-right text-muted-foreground font-medium whitespace-nowrap">
                  Neto USDT
                </th>
                <th className="px-4 py-3 text-center text-muted-foreground font-medium whitespace-nowrap">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {cyclesLoading &&
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

              {!cyclesLoading && filteredCycles.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No hay ciclos registrados.
                  </td>
                </tr>
              )}

              {!cyclesLoading &&
                filteredCycles.map((c) => {
                  const totalFees =
                    Number(c.sellFeeUsdt ?? 0) +
                    Number(c.buyFeeUsdt ?? 0) +
                    Number(c.pmFeeUsdt ?? 0);

                  const netNum = c.netUsdt != null ? Number(c.netUsdt) : null;
                  const netColorRow =
                    netNum == null
                      ? ''
                      : netNum >= 0
                      ? 'text-green-400'
                      : 'text-red-400';

                  return (
                    <tr
                      key={c.id}
                      className="border-t border-border hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-foreground">
                        {fmtDate(c.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {fmtDate(c.closedAt)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                        {fmt2(c.sellUsdt)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                        {fmt2(c.buyUsdtTotal)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                        {fmt4(totalFees)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right whitespace-nowrap tabular-nums font-bold ${netColorRow}`}
                      >
                        {c.netUsdt != null ? fmt2(c.netUsdt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={c.status === 'CLOSED' ? 'default' : 'secondary'}
                        >
                          {c.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
