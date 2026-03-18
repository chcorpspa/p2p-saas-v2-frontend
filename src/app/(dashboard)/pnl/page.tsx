'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, DollarSign, Clock, ChevronDown, Download } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PnlSummary { closedCycles: number; totalNetUsdt: string; }

interface CycleOrder {
  orderNo: string;
  trade_type: 'BUY' | 'SELL';
  asset: string;
  fiat: string;
  amount: number;
  unit_price: number;
  total_price: number;
  portion_usdt: number;
  portion_fiat: number;
  portion_pct: number;
  counterparty: string;
}

interface EnrichedCycle {
  id: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
  sell_amount: number;
  sell_total_fiat: number;
  sell_unit_price: number;
  buy_amount: number;
  buy_total_fiat: number;
  buy_avg_price: number;
  pending_ves: number;
  spread_profit_ves: number;
  gross_usdt: number;
  net_usdt_recovered: number;
  real_net_profit_usdt: number;
  sell_binance_fee_usdt: number;
  buy_binance_fee_usdt: number;
  buy_pm_fee_usdt: number;
  total_fees: number;
  orders: CycleOrder[];
  fiat: string;
  opened_at: string;
  netUsdt: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtUsdt(n: number) { return n.toFixed(2); }
function fmtUsdtAmt(n: number) { return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtFiat(n: number, fiat = 'VES') {
  const fmt = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (['VES','COP','CLP','ARS'].includes(fiat)) return fmt.replace(/,/g, 'X').replace(/\./g, ',').replace(/X/g, '.');
  return fmt;
}

// ─── Expandable Cycle Card (ported from old system index.html:6083-6253) ────

function CycleCard({ c, onClose }: { c: EnrichedCycle; onClose: (id: string, adj?: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [adjVes, setAdjVes] = useState('');

  const isOpen = c.status === 'OPEN';
  const netUsdt = c.real_net_profit_usdt;
  const isPositive = netUsdt >= 0;
  const date = c.opened_at ? new Date(c.opened_at).toLocaleDateString('es-VE') : '—';
  const sellPrice = fmtFiat(c.sell_unit_price, c.fiat);
  const buyTotal = fmtFiat(c.buy_total_fiat, c.fiat);
  const pendingVes = fmtFiat(c.pending_ves, c.fiat);
  const avgBuyPrice = c.buy_avg_price > 0 ? fmtFiat(c.buy_avg_price, c.fiat) : '—';
  const spreadVal = c.buy_avg_price > 0 ? fmtFiat(c.sell_unit_price - c.buy_avg_price, c.fiat) : '—';
  const grossVes = fmtFiat(c.spread_profit_ves, c.fiat);

  // Progress bar for open cycles
  const confirmedPct = c.sell_total_fiat > 0 ? Math.min(100, (c.buy_total_fiat / c.sell_total_fiat) * 100) : 0;

  return (
    <div className="rounded-xl border border-border overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
      {/* Header — clickable */}
      <div onClick={() => setExpanded(!expanded)} className="cursor-pointer px-4 py-3 flex items-center justify-between hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isOpen ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
            {isOpen ? '🔄 Abierto' : '✅ Cerrado'}
          </span>
          <span className="text-xs text-muted-foreground">{date}</span>
          <div className="flex flex-col gap-0.5 ml-1">
            <span className="text-foreground font-bold text-sm">
              {fmtUsdtAmt(c.sell_amount)} USDT
              <span className="text-green-400 font-semibold text-xs ml-1.5">= +{fmtFiat(c.sell_total_fiat, c.fiat)} {c.fiat}</span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              Tasa de venta: <span className="text-primary font-bold">{sellPrice} {c.fiat}</span>
            </span>
          </div>
        </div>
        <div className="text-right flex items-center gap-2">
          {isOpen ? (
            <div>
              <div className="text-red-400 font-bold text-sm">-{pendingVes} <span className="text-[10px]">{c.fiat}</span></div>
              <div className="text-[10px] text-muted-foreground">falta recomprar</div>
            </div>
          ) : (
            <div>
              <div className={`font-bold text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}{fmtUsdt(netUsdt)} USDT
              </div>
              <div className="text-[10px] text-muted-foreground">neto</div>
            </div>
          )}
          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Body — expandable */}
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {/* Progress bar for open */}
          {isOpen && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1a1f35' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${confirmedPct.toFixed(1)}%`, background: confirmedPct >= 100 ? '#4ade80' : '#f0b90b' }} />
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{confirmedPct.toFixed(1)}% confirmado</span>
            </div>
          )}

          {/* Orders */}
          {c.orders.map((o, i) => {
            const isParcial = o.portion_pct < 0.999;
            const dispUsdt = isParcial ? o.portion_usdt : o.amount;
            const dispFiat = isParcial ? o.portion_fiat : o.total_price;
            return (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 text-xs">
                <span className="text-muted-foreground">{o.trade_type === 'SELL' ? '📤 Venta' : '📥 Recompra'}</span>
                <span className="text-foreground font-mono">
                  {fmtUsdtAmt(dispUsdt)} {o.asset} × {fmtFiat(o.unit_price, c.fiat)}
                  {isParcial && <span className="text-purple-400 text-[10px] ml-1">(parcial: {fmtFiat(dispFiat, c.fiat)} de {fmtFiat(o.total_price, c.fiat)} {c.fiat})</span>}
                </span>
                <span className="text-foreground">{fmtFiat(dispFiat, c.fiat)} {c.fiat}</span>
              </div>
            );
          })}

          {/* Totals */}
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs py-1 border-b border-border/30">
              <span className="text-muted-foreground">Total recomprado</span>
              <span className="text-foreground font-mono">{fmtUsdtAmt(c.buy_amount)} USDT</span>
              <span className="text-red-400">-{buyTotal} {c.fiat}</span>
            </div>
            <div className="flex justify-between text-xs py-1 border-b border-border/30">
              <span className="text-muted-foreground">Precio promedio recompra</span>
              <span></span>
              <span className="text-muted-foreground">{avgBuyPrice} {c.fiat} <span className="text-green-400 text-[10px]">(spread: +{spreadVal})</span></span>
            </div>

            {/* Middle row: pending or gross */}
            {isOpen ? (
              <div className="flex justify-between text-xs py-1 border-b border-border/30">
                <span className="text-muted-foreground">Falta por recomprar</span>
                <span className="text-red-400 text-[10px]">≈ -{c.buy_avg_price > 0 ? fmtUsdt(c.pending_ves / c.buy_avg_price) : '—'} USDT</span>
                <span className="text-red-400">-{pendingVes} {c.fiat}</span>
              </div>
            ) : (
              <div className="flex justify-between text-xs py-1 border-b border-border/30">
                <span className="text-muted-foreground">Ganancia bruta</span>
                <span className="text-green-400 text-[10px]">+{fmtUsdt(c.gross_usdt)} USDT <span className="text-muted-foreground">(recuperados: +{fmtUsdtAmt(c.net_usdt_recovered)})</span></span>
                <span className="text-green-400">+{grossVes} {c.fiat}</span>
              </div>
            )}

            {/* Fees */}
            <div className="flex justify-between text-xs py-1 border-b border-border/30">
              <span className="text-muted-foreground">Fee Binance venta</span>
              <span className="text-muted-foreground/60 text-[10px]">sobre {fmtFiat(c.sell_total_fiat, c.fiat)} {c.fiat}</span>
              <span className="text-red-400">-{fmtUsdt(c.sell_binance_fee_usdt)} USDT</span>
            </div>
            <div className="flex justify-between text-xs py-1 border-b border-border/30">
              <span className="text-muted-foreground">Fee Binance recompra</span>
              <span className="text-muted-foreground/60 text-[10px]">sobre {fmtFiat(c.buy_total_fiat, c.fiat)} {c.fiat}</span>
              <span className="text-red-400">-{fmtUsdt(c.buy_binance_fee_usdt)} USDT</span>
            </div>
            <div className="flex justify-between text-xs py-1 border-b border-border/30">
              <span className="text-muted-foreground">Fee Pago Móvil</span>
              <span className="text-muted-foreground/60 text-[10px]">sobre {fmtFiat(c.buy_total_fiat, c.fiat)} {c.fiat}</span>
              <span className="text-red-400">-{fmtUsdt(c.buy_pm_fee_usdt)} USDT</span>
            </div>

            {/* NET PROFIT */}
            <div className="flex justify-between text-sm py-2 font-bold mt-1" style={{ borderTop: '2px solid rgba(255,255,255,0.1)' }}>
              <span className="text-foreground">{isOpen ? 'GANANCIA ESTIMADA' : 'GANANCIA NETA'}</span>
              <span></span>
              <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
                {isPositive ? '+' : ''}{fmtUsdt(netUsdt)} USDT
              </span>
            </div>
          </div>

          {/* Close button for open cycles */}
          {isOpen && (
            <div className="mt-3 pt-3 border-t border-border">
              {!showCloseModal ? (
                <Button size="sm" variant="outline" onClick={() => setShowCloseModal(true)} className="text-xs">
                  Cerrar ciclo manualmente
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Ajuste VES recuperados fuera de Binance (opcional):</p>
                  <div className="flex gap-2">
                    <input type="number" value={adjVes} onChange={e => setAdjVes(e.target.value)} placeholder="0"
                      className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-sm font-mono" />
                    <Button size="sm" onClick={() => { setAdjVes(String(c.pending_ves)); }} variant="outline" className="text-xs">Todo</Button>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { onClose(c.id, parseFloat(adjVes) || 0); setShowCloseModal(false); }}
                      className="bg-primary text-primary-foreground text-xs">Cerrar</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowCloseModal(false)} className="text-xs">Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PnlPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'cycles' | 'monthly' | 'yearly'>('cycles');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; });
  const [year, setYear] = useState(() => String(new Date().getFullYear()));

  const { data: summary } = useQuery<PnlSummary>({
    queryKey: ['pnl-summary'],
    queryFn: () => api.get('/pnl/summary').then(r => r.data),
  });

  const { data: cycles = [], isLoading } = useQuery<EnrichedCycle[]>({
    queryKey: ['pnl-cycles'],
    queryFn: () => api.get('/pnl/cycles').then(r => r.data),
  });

  const { data: monthlyData } = useQuery({
    queryKey: ['pnl-monthly', month],
    queryFn: () => api.get('/pnl/monthly', { params: { month } }).then(r => r.data),
    enabled: tab === 'monthly',
  });

  const { data: yearlyData } = useQuery({
    queryKey: ['pnl-yearly', year],
    queryFn: () => api.get('/pnl/yearly', { params: { year } }).then(r => r.data),
    enabled: tab === 'yearly',
  });

  const closeCycle = async (cycleId: string, adjustmentVes?: number) => {
    try {
      await api.post(`/pnl/cycles/${cycleId}/close`, { adjustmentVes });
      toast.success('Ciclo cerrado');
      qc.invalidateQueries({ queryKey: ['pnl-cycles'] });
      qc.invalidateQueries({ queryKey: ['pnl-summary'] });
    } catch (e: any) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const filteredCycles = cycles.filter(c => {
    if (statusFilter === 'OPEN') return c.status === 'OPEN';
    if (statusFilter === 'CLOSED') return c.status === 'CLOSED' || c.status === 'MANUAL_CLOSED';
    return true;
  });

  const openCycles = cycles.filter(c => c.status === 'OPEN').length;
  const totalFees = cycles.reduce((s, c) => s + (c.total_fees || 0), 0);

  const exportCSV = () => {
    const token = localStorage.getItem('token');
    fetch('/api/pnl/export/csv', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob()).then(blob => { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = 'pnl-cycles.csv'; a.click(); })
      .catch(() => toast.error('Error'));
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">P&L — Ciclos de Trading</h1>
        <button onClick={exportCSV} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 border border-border rounded px-2 py-1">
          <Download size={12} /> Exportar CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp size={16} className="text-green-400" /><span className="text-xs text-muted-foreground">Ciclos Cerrados</span></div>
          <p className="text-xl font-bold">{summary?.closedCycles ?? 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Clock size={16} className="text-amber-400" /><span className="text-xs text-muted-foreground">Ciclos Abiertos</span></div>
          <p className="text-xl font-bold text-amber-400">{openCycles}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign size={16} className="text-green-400" /><span className="text-xs text-muted-foreground">Ganancia Neta</span></div>
          <p className="text-xl font-bold text-green-400">{summary?.totalNetUsdt ?? '0.00'} USDT</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign size={16} className="text-red-400" /><span className="text-xs text-muted-foreground">Fee Binance</span></div>
          <p className="text-sm font-bold text-red-400">-{fmtUsdt(cycles.reduce((s,c) => s + (c.sell_binance_fee_usdt||0) + (c.buy_binance_fee_usdt||0), 0))} USDT</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign size={16} className="text-red-400" /><span className="text-xs text-muted-foreground">Fee Pago Móvil</span></div>
          <p className="text-sm font-bold text-red-400">-{fmtUsdt(cycles.reduce((s,c) => s + (c.buy_pm_fee_usdt||0), 0))} USDT</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign size={16} className="text-red-400" /><span className="text-xs text-muted-foreground">Falta Recomprar</span></div>
          <p className="text-sm font-bold text-red-400">-{fmtUsdt(cycles.filter(c=>c.status==='OPEN').reduce((s,c) => s + (c.pending_ves > 0 && c.buy_avg_price > 0 ? c.pending_ves/c.buy_avg_price : 0), 0))} USDT</p>
        </div>
      </div>

      {/* Tabs + filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['cycles', 'monthly', 'yearly'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs rounded border font-medium ${tab === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
            {t === 'cycles' ? '📊 Ciclos' : t === 'monthly' ? '📅 Mensual' : '📈 Anual'}
          </button>
        ))}
        {tab === 'cycles' && (
          <>
            <div className="ml-4 flex gap-1">
              {(['ALL', 'OPEN', 'CLOSED'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2 py-1 text-[10px] rounded ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {s === 'ALL' ? 'Todos' : s}
                </button>
              ))}
            </div>
          </>
        )}
        {tab === 'monthly' && <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="ml-4 bg-secondary border border-border rounded px-2 py-1 text-xs" />}
        {tab === 'yearly' && <input type="number" value={year} onChange={e => setYear(e.target.value)} min="2024" max="2030" className="ml-4 bg-secondary border border-border rounded px-2 py-1 text-xs w-20" />}
      </div>

      {/* Content */}
      {tab === 'cycles' && (
        isLoading ? <p className="text-muted-foreground text-sm py-8 text-center">Cargando ciclos...</p> :
        filteredCycles.length === 0 ? <p className="text-muted-foreground text-sm py-8 text-center">Sin ciclos</p> :
        <div>
          {filteredCycles.map(c => <CycleCard key={c.id} c={c} onClose={closeCycle} />)}
        </div>
      )}

      {tab === 'monthly' && monthlyData && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Ciclos cerrados</p>
              <p className="text-xl font-bold">{monthlyData.closedCycles}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Ganancia neta</p>
              <p className="text-xl font-bold text-green-400">{monthlyData.totalNetUsdt} USDT</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'yearly' && yearlyData && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Ciclos cerrados</p>
              <p className="text-xl font-bold">{yearlyData.closedCycles}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Ganancia neta</p>
              <p className="text-xl font-bold text-green-400">{yearlyData.totalNetUsdt} USDT</p>
            </div>
          </div>
          {yearlyData.byMonth && (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-card"><tr><th className="text-left p-3 text-muted-foreground font-normal">Mes</th><th className="text-right p-3 text-muted-foreground font-normal">Ciclos</th><th className="text-right p-3 text-muted-foreground font-normal">Neto USDT</th></tr></thead>
                <tbody>
                  {Object.entries(yearlyData.byMonth).map(([m, d]: [string, any]) => (
                    <tr key={m} className="border-t border-border"><td className="p-3">{m}</td><td className="p-3 text-right">{d.count}</td><td className="p-3 text-right text-green-400">{d.netUsdt.toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
