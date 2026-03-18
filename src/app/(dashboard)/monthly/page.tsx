'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import api from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DayData { net_gain: number; cycles_closed: number; }
interface MonthlyData {
  month: string;
  closedCycles: number;
  totalNetUsdt: string;
  days: Record<string, DayData>;
  summary: { total_gain: number; avg_daily: number; days_operated: number; total_cycles: number };
}
interface YearlyData {
  year: number;
  closedCycles: number;
  totalNetUsdt: string;
  byMonth: Record<string, { count: number; netUsdt: number }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

// ─── Main ────────────────────────────────────────────────────────────────────

export default function MonthlyPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const { data: monthlyData, isLoading, refetch } = useQuery<MonthlyData>({
    queryKey: ['monthly', monthStr],
    queryFn: () => api.get('/pnl/monthly', { params: { month: monthStr } }).then(r => r.data),
  });

  const { data: yearlyData } = useQuery<YearlyData>({
    queryKey: ['yearly', year],
    queryFn: () => api.get('/pnl/yearly', { params: { year: String(year) } }).then(r => r.data),
  });

  function navMonth(dir: number) {
    let m = month + dir;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  }

  // Calendar grid
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const startDay = (firstDow + 6) % 7; // Mon=0
  const maxWeeks = Math.ceil((startDay + daysInMonth) / 7);
  const days = monthlyData?.days || {};
  const summary = monthlyData?.summary;

  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const todayDate = now.getDate();

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">📅 Panel Mensual</h1>
        <button onClick={() => refetch()} className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <button onClick={() => navMonth(-1)} className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground"><ChevronLeft size={16} /></button>
        <span className="text-lg font-bold text-foreground">{MONTH_NAMES[month - 1]} {year}</span>
        <button onClick={() => navMonth(1)} className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground"><ChevronRight size={16} /></button>
      </div>

      {/* Calendar */}
      <div className="bg-card border border-border rounded-xl p-4">
        {isLoading ? (
          <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* Header */}
            <div className="grid grid-cols-8 gap-1 mb-2">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-[10px] text-muted-foreground font-semibold uppercase">{d}</div>
              ))}
              <div className="text-center text-[10px] text-primary font-semibold uppercase">Semana</div>
            </div>

            {/* Weeks */}
            {Array.from({ length: maxWeeks }, (_, w) => {
              let weekTotal = 0;
              let weekHasData = false;

              return (
                <div key={w} className="grid grid-cols-8 gap-1 mb-1">
                  {Array.from({ length: 7 }, (_, d) => {
                    const cellIdx = w * 7 + d;
                    const dayNum = cellIdx - startDay + 1;

                    if (dayNum < 1 || dayNum > daysInMonth) {
                      return <div key={d} className="h-16 rounded-lg" />;
                    }

                    const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const dayData = days[dayStr];
                    const gain = dayData?.net_gain ?? 0;
                    const cycles = dayData?.cycles_closed ?? 0;
                    const isToday = isCurrentMonth && dayNum === todayDate;

                    if (gain !== 0) weekHasData = true;
                    weekTotal += gain;

                    return (
                      <div key={d} className={`h-16 rounded-lg p-1.5 flex flex-col items-center justify-center transition-colors ${isToday ? 'ring-1 ring-primary' : ''}`}
                        style={{ background: gain > 0 ? 'rgba(74,222,128,0.08)' : gain < 0 ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.02)' }}>
                        <span className={`text-[10px] ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>{dayNum}</span>
                        <span className={`text-xs font-bold ${gain > 0 ? 'text-green-400' : gain < 0 ? 'text-red-400' : 'text-muted-foreground/40'}`}>
                          {gain !== 0 ? (gain > 0 ? '+' : '') + gain.toFixed(2) : dayData ? '0.00' : '—'}
                        </span>
                        {cycles > 0 && <span className="text-[8px] text-muted-foreground">{cycles} ciclo{cycles > 1 ? 's' : ''}</span>}
                      </div>
                    );
                  })}
                  {/* Week total */}
                  <div className="h-16 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className={`text-xs font-bold ${weekTotal > 0 ? 'text-green-400' : weekTotal < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {weekHasData ? (weekTotal > 0 ? '+' : '') + weekTotal.toFixed(2) : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Monthly summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Ganancia del Mes</p>
            <p className={`text-lg font-bold ${summary.total_gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {summary.total_gain > 0 ? '+' : ''}{summary.total_gain.toFixed(2)} USDT
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Promedio Diario</p>
            <p className="text-lg font-bold text-blue-400">{summary.avg_daily > 0 ? '+' : ''}{summary.avg_daily.toFixed(2)} USDT</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Días Operados</p>
            <p className="text-lg font-bold">{summary.days_operated}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Ciclos Cerrados</p>
            <p className="text-lg font-bold">{summary.total_cycles}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Rendimiento</p>
            <p className="text-lg font-bold text-primary">—</p>
          </div>
        </div>
      )}

      {/* Yearly accumulator */}
      {yearlyData && yearlyData.byMonth && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Acumulado Anual {year}</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/3">
                <tr>
                  <th className="text-left p-3 text-muted-foreground font-normal">Mes</th>
                  <th className="text-right p-3 text-muted-foreground font-normal">Ciclos</th>
                  <th className="text-right p-3 text-muted-foreground font-normal">Neto USDT</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(yearlyData.byMonth).map(([m, d]: [string, any]) => (
                  <tr key={m} className="border-t border-border">
                    <td className="p-3">{MONTH_NAMES[parseInt(m.split('-')[1]) - 1] || m}</td>
                    <td className="p-3 text-right">{d.count}</td>
                    <td className={`p-3 text-right font-bold ${d.netUsdt >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {d.netUsdt > 0 ? '+' : ''}{d.netUsdt.toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border">
                  <td className="p-3 font-bold">Total</td>
                  <td className="p-3 text-right font-bold">{yearlyData.closedCycles}</td>
                  <td className={`p-3 text-right font-bold ${parseFloat(yearlyData.totalNetUsdt) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {parseFloat(yearlyData.totalNetUsdt) > 0 ? '+' : ''}{yearlyData.totalNetUsdt}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
