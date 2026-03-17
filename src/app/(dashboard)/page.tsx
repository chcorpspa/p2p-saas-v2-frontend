'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Activity, Key, TrendingUp, DollarSign } from 'lucide-react';
import api from '@/lib/api';
import { useSocket } from '@/lib/socket';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
  id: string;
  label: string;
  isMerchant: boolean;
  isActive: boolean;
  createdAt: string;
}

interface Bot {
  id: string;
  status: 'RUNNING' | 'STOPPED' | 'ERROR';
  advNo: string;
  mode: string;
  account: { label: string };
}

interface PnlSummary {
  closedCycles: number;
  totalNetUsdt: string;
}

interface Order {
  id: string;
  orderNo: string;
  orderType: 'BUY' | 'SELL';
  amount: string | number;
  status?: string;
  completedAt?: string;
}

interface OrdersResponse {
  orders: Order[];
  total: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUsdt(value: string | number | undefined): string {
  if (value === undefined || value === null) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function truncateOrderNo(orderNo: string): string {
  if (!orderNo) return '—';
  if (orderNo.length <= 12) return orderNo;
  return `${orderNo.slice(0, 6)}…${orderNo.slice(-4)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
      <div className="h-4 w-24 bg-muted rounded mb-4" />
      <div className="h-8 w-16 bg-muted rounded mb-2" />
      <div className="h-3 w-20 bg-muted rounded" />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor?: string;
}

function StatCard({ label, value, subtitle, icon, iconBg, valueColor, accentClass }: StatCardProps & { accentClass?: string }) {
  return (
    <div className={`bg-card border border-border rounded-xl p-5 flex items-start justify-between gap-4 card-hover overflow-hidden relative ${accentClass ?? ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">{label}</p>
        <p className={`text-2xl font-bold leading-tight tracking-tight ${valueColor ?? 'text-foreground'}`}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
        )}
      </div>
      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
}

type BotStatus = 'RUNNING' | 'STOPPED' | 'ERROR';

function BotStatusBadge({ status }: { status: BotStatus }) {
  const styles: Record<BotStatus, string> = {
    RUNNING: 'bg-green-500/15 text-green-400 border border-green-500/30',
    STOPPED: 'bg-muted text-muted-foreground border border-border',
    ERROR: 'bg-red-500/15 text-red-400 border border-red-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${styles[status]}`}>
      {status === 'RUNNING' && (
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse" />
      )}
      {status}
    </span>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20">
      {mode}
    </span>
  );
}

function OrderTypeBadge({ type }: { type: 'BUY' | 'SELL' }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
        type === 'BUY'
          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
      }`}
    >
      {type}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);

  // Real-time socket invalidation
  useEffect(() => {
    if (!socket) return;

    const onBotTick = () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      setSecondsSinceUpdate(0);
    };
    const onPnlUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['pnl-summary'] });
      setSecondsSinceUpdate(0);
    };

    socket.on('bot:tick', onBotTick);
    socket.on('pnl:update', onPnlUpdate);

    return () => {
      socket.off('bot:tick', onBotTick);
      socket.off('pnl:update', onPnlUpdate);
    };
  }, [socket, queryClient]);

  // "Last updated" counter
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsSinceUpdate((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: me } = useQuery<{ plan: string; planExpires?: string }>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then(r => r.data),
    staleTime: 60_000,
  });

  const { data: accounts, isLoading: loadingAccounts } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then((r) => r.data),
    staleTime: 30_000,
  });

  const { data: bots, isLoading: loadingBots } = useQuery<Bot[]>({
    queryKey: ['bots'],
    queryFn: () => api.get('/bots').then((r) => r.data),
    staleTime: 10_000,
  });

  const { data: pnl, isLoading: loadingPnl } = useQuery<PnlSummary>({
    queryKey: ['pnl-summary'],
    queryFn: () => api.get('/pnl/summary').then((r) => r.data),
    staleTime: 30_000,
  });

  const { data: ordersData, isLoading: loadingOrders } = useQuery<OrdersResponse>({
    queryKey: ['orders-recent'],
    queryFn: () => api.get('/orders?page=1&limit=5').then((r) => r.data),
    staleTime: 15_000,
  });

  // ── Derived values ────────────────────────────────────────────────────────

  const runningBots = bots?.filter((b) => b.status === 'RUNNING').length ?? 0;
  const totalBots = bots?.length ?? 0;
  const activeAccounts = accounts?.filter((a) => a.isActive).length ?? 0;
  const closedCycles = pnl?.closedCycles ?? 0;
  const totalNet = pnl?.totalNetUsdt;
  const netNum = totalNet ? parseFloat(totalNet) : 0;
  const netPositive = netNum > 0;
  const netNegative = netNum < 0;

  const isInitialLoading = loadingAccounts && loadingBots && loadingPnl;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Panel de control</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vista general del sistema P2P
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Última actualización: hace {secondsSinceUpdate}s
        </p>
      </div>

      {/* Plan info card */}
      {(() => {
        const planName = me?.plan || 'PRO';
        const expires = me?.planExpires ? new Date(me.planExpires) : null;
        const daysLeft = expires ? Math.ceil((expires.getTime() - Date.now()) / 86400000) : null;
        const expiryColor = daysLeft === null ? 'text-muted-foreground' : daysLeft <= 0 ? 'text-red-500' : daysLeft <= 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-orange-400' : 'text-green-400';
        return (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <span className="font-bold text-foreground">Plan {planName}</span>
              </div>
              {daysLeft !== null && (
                <span className={`text-xs font-semibold ${expiryColor}`}>
                  {daysLeft <= 0 ? 'Expirado' : `${daysLeft} días restantes`}
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Cuentas</p>
                <p className="text-lg font-bold text-foreground">{activeAccounts}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Bots</p>
                <p className="text-lg font-bold text-foreground">{totalBots}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Activos</p>
                <p className="text-lg font-bold text-green-400">{runningBots}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Ganancia</p>
                <p className={`text-lg font-bold ${netPositive ? 'text-green-400' : netNegative ? 'text-red-400' : 'text-foreground'}`}>{formatUsdt(totalNet)}</p>
              </div>
            </div>
            {expires && (
              <div className="mt-3">
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.max(0, Math.min(100, (daysLeft ?? 0) / 30 * 100))}%`,
                    background: daysLeft !== null && daysLeft <= 3 ? '#ef4444' : daysLeft !== null && daysLeft <= 7 ? '#f59e0b' : '#6857ff',
                  }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Vence: {expires.toLocaleDateString('es-VE')}
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Stat Cards */}
      {isInitialLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Bots Activos */}
          <StatCard
            label="Bots Activos"
            value={`${runningBots} / ${totalBots}`}
            subtitle={totalBots === 0 ? 'Sin bots configurados' : `${totalBots - runningBots} detenidos`}
            icon={<Activity className="w-4.5 h-4.5 text-green-400" />}
            iconBg="bg-green-500/15"
            valueColor={runningBots > 0 ? 'text-green-400' : 'text-foreground'}
            accentClass="stat-card-green"
          />

          {/* Cuentas */}
          <StatCard
            label="Cuentas"
            value={activeAccounts}
            subtitle={
              accounts
                ? `${accounts.length - activeAccounts} inactivas`
                : 'Cargando…'
            }
            icon={<Key className="w-4.5 h-4.5 text-primary" />}
            iconBg="bg-primary/15"
            accentClass="stat-card-yellow"
          />

          {/* Ciclos P&L */}
          <StatCard
            label="Ciclos Cerrados"
            value={closedCycles}
            subtitle="Ciclos completados"
            icon={<TrendingUp className="w-4.5 h-4.5 text-blue-400" />}
            iconBg="bg-blue-500/15"
            accentClass="stat-card-blue"
          />

          {/* Ganancia Neta */}
          <StatCard
            label="Ganancia Neta"
            value={`${formatUsdt(totalNet)} USDT`}
            subtitle={totalNet ? (netPositive ? 'Ganancia acumulada' : 'Pérdida acumulada') : 'Sin datos'}
            icon={<DollarSign className="w-4.5 h-4.5 text-amber-400" />}
            iconBg="bg-amber-500/15"
            valueColor={
              netPositive
                ? 'text-green-400'
                : netNegative
                ? 'text-red-400'
                : 'text-foreground'
            }
            accentClass="stat-card-amber"
          />
        </div>
      )}

      {/* Bottom two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left — Bots list (60%) */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl flex flex-col">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-base font-semibold text-foreground">Estado de Bots</h2>
            <Link
              href="/bots"
              className="text-xs text-primary hover:underline font-medium"
            >
              Ver todos →
            </Link>
          </div>

          <div className="divide-y divide-border flex-1">
            {loadingBots ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-5 w-16 bg-muted rounded ml-auto" />
                  <div className="h-5 w-14 bg-muted rounded" />
                </div>
              ))
            ) : bots && bots.length > 0 ? (
              bots.slice(0, 8).map((bot) => (
                <div key={bot.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {bot.account?.label ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {bot.advNo}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <BotStatusBadge status={bot.status} />
                    <ModeBadge mode={bot.mode} />
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                No hay bots configurados.{' '}
                <Link href="/bots" className="text-primary hover:underline">
                  Crear uno
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right — Recent orders (40%) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl flex flex-col">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-base font-semibold text-foreground">Últimas Órdenes</h2>
            <Link
              href="/orders"
              className="text-xs text-primary hover:underline font-medium"
            >
              Ver todas →
            </Link>
          </div>

          <div className="divide-y divide-border flex-1">
            {loadingOrders ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-5 w-12 bg-muted rounded ml-auto" />
                </div>
              ))
            ) : ordersData && ordersData.orders.length > 0 ? (
              ordersData.orders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-foreground truncate">
                      {truncateOrderNo(order.orderNo)}
                    </p>
                    {order.amount !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        {formatUsdt(order.amount)} USDT
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <OrderTypeBadge type={order.orderType} />
                    {order.status && (
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {order.status}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                No hay órdenes recientes.
              </div>
            )}
          </div>

          {ordersData && (
            <div className="px-5 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {ordersData.total} órdenes en total
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
