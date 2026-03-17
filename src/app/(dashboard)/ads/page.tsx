'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSocket } from '@/lib/socket';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
  id: string;
  label: string;
  isActive: boolean;
  isMerchant: boolean;
}

interface Bot {
  id: string;
  advNo: string;
  status: 'RUNNING' | 'STOPPED' | 'ERROR' | 'PAUSED';
  mode: string;
  currentPrice?: number | null;
  lastTickAt?: string | null;
  account: { id: string; label: string };
}

interface AdStatus {
  advStatus: number;
  tradeType: string;
  price?: string;
  surplusAmount?: string;
  minAmount?: string;
  maxAmount?: string;
}

// advStatus from Binance: 1=Online, 3=Offline, 4=Closed
const ADV_STATUS: Record<number, { label: string; dot: string }> = {
  1: { label: 'Publicado', dot: 'bg-emerald-400' },
  3: { label: 'Offline',   dot: 'bg-amber-400' },
  4: { label: 'Cerrado',   dot: 'bg-red-400' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(date: string | null | undefined): string {
  if (!date) return '—';
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

function fmt(n: number) {
  return n.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Bot Status Badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; pulse?: boolean }> = {
    RUNNING: { label: 'Activo',   cls: 'bg-green-500/20 text-green-400 border-green-500/30',  pulse: true },
    ERROR:   { label: 'Error',    cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    PAUSED:  { label: 'Pausado',  cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    STOPPED: { label: 'Detenido', cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  };
  const { label, cls, pulse } = map[status] ?? map['STOPPED'];
  const dotColor = status === 'RUNNING' ? 'bg-green-500' : status === 'ERROR' ? 'bg-red-500' : status === 'PAUSED' ? 'bg-amber-500' : 'bg-gray-500';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${dotColor} ${pulse ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  );
}

// ─── Mode Badge ───────────────────────────────────────────────────────────────

function ModeBadge({ mode }: { mode: string }) {
  const styles: Record<string, string> = {
    DYNAMIC: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    FIXED:   'bg-gray-500/20 text-gray-400 border-gray-500/30',
    SPREAD:  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };
  const cls = styles[mode] ?? styles['FIXED'];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs border ${cls}`}>
      {mode}
    </span>
  );
}

// ─── AdvNo copyable ───────────────────────────────────────────────────────────

function AdvNoCell({ advNo }: { advNo: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    navigator.clipboard.writeText(advNo).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar advNo"
      className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors group flex items-center gap-1.5"
    >
      <span className="truncate max-w-[130px]">{advNo}</span>
      <span className={`text-xs transition-opacity duration-200 ${copied ? 'text-green-400 opacity-100' : 'text-muted-foreground opacity-0 group-hover:opacity-60'}`}>
        {copied ? '✓' : '⎘'}
      </span>
    </button>
  );
}

// ─── Ad Card ──────────────────────────────────────────────────────────────────

function AdCard({
  bot,
  adStatus,
}: {
  bot: Bot;
  adStatus?: AdStatus;
}) {
  // tradeType: prefer live Binance data, fallback to nothing
  const tradeType = adStatus?.tradeType ?? null;
  const isSell = tradeType === 'SELL';
  const isBuy  = tradeType === 'BUY';

  // Border accent: red=SELL (Venta), green=BUY (Compra), neutral=unknown
  const borderAccent = isSell
    ? 'border-l-red-500'
    : isBuy
    ? 'border-l-emerald-500'
    : 'border-l-border';

  // Trade type pill
  const tradePill = isSell ? (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
      VENTA
    </span>
  ) : isBuy ? (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
      COMPRA
    </span>
  ) : null;

  // Price: prefer live currentPrice from bot tick, fallback to adStatus.price
  const displayPrice = bot.currentPrice != null
    ? fmt(bot.currentPrice)
    : adStatus?.price
    ? Number(adStatus.price).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;

  // Binance ad status
  const advStatusInfo = adStatus ? ADV_STATUS[adStatus.advStatus] : null;

  // Amounts from Binance
  const surplus  = adStatus?.surplusAmount  ? parseFloat(adStatus.surplusAmount).toFixed(2)  : null;
  const minAmt   = adStatus?.minAmount      ? parseFloat(adStatus.minAmount).toFixed(2)       : null;
  const maxAmt   = adStatus?.maxAmount      ? parseFloat(adStatus.maxAmount).toFixed(2)       : null;

  return (
    <Link
      href={`/bots/${bot.id}`}
      className={`
        block bg-card border border-border border-l-4 ${borderAccent}
        rounded-xl overflow-hidden
        hover:bg-muted/20 hover:shadow-lg hover:shadow-black/20
        transition-all duration-200 group
      `}
    >
      {/* Card header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5 min-w-0">
          {/* Account */}
          <span className="text-xs text-muted-foreground font-medium truncate">
            {bot.account.label}
          </span>
          {/* advNo */}
          <AdvNoCell advNo={bot.advNo} />
        </div>

        {/* Trade type pill */}
        <div className="flex-shrink-0">
          {tradePill}
        </div>
      </div>

      {/* Price — main metric */}
      <div className="px-4 pb-3">
        {displayPrice ? (
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold tracking-tight ${isSell ? 'text-red-400' : isBuy ? 'text-emerald-400' : 'text-primary'}`}>
              {displayPrice}
            </span>
            <span className="text-xs text-muted-foreground font-medium">VES/USDT</span>
          </div>
        ) : (
          <span className="text-2xl font-bold text-muted-foreground/40">—</span>
        )}
      </div>

      {/* Amounts row */}
      {(surplus !== null || minAmt !== null) && (
        <div className="px-4 pb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {surplus !== null && (
            <span>
              Disponible: <span className="text-foreground font-medium">{surplus} USDT</span>
            </span>
          )}
          {minAmt !== null && maxAmt !== null && (
            <span>
              Límites: <span className="text-foreground font-medium">{minAmt}–{maxAmt} USD</span>
            </span>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border/50 mx-4" />

      {/* Footer */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <StatusBadge status={bot.status} />
          <ModeBadge mode={bot.mode} />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Binance live status */}
          {advStatusInfo ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${advStatusInfo.dot}`} />
              {advStatusInfo.label}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}

          {/* Last tick */}
          <span className="text-xs text-muted-foreground/60 hidden sm:block">
            {relativeTime(bot.lastTickAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdsPage() {
  const qc = useQueryClient();
  const socket = useSocket();
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [_tick, setTick] = useState(0);

  // Re-render every 10s to update relative timestamps
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch accounts for the selector
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then(r => r.data),
  });

  // Fetch all bots
  const { data: bots = [], isLoading } = useQuery<Bot[]>({
    queryKey: ['bots'],
    queryFn: () => api.get('/bots').then(r => r.data),
    refetchInterval: 15000,
  });

  // Fetch real Binance ad statuses (all accounts, merged)
  const { data: adStatuses = {} } = useQuery<Record<string, AdStatus>>({
    queryKey: ['ad-statuses'],
    queryFn: async () => {
      const accountIds = [...new Set(bots.map(b => b.account.id))];
      const results = await Promise.all(
        accountIds.map(id =>
          api.get<Record<string, AdStatus>>(`/bots/accounts/${id}/ad-statuses`)
            .then(r => r.data)
            .catch(() => ({} as Record<string, AdStatus>))
        )
      );
      return results.reduce((acc, r) => ({ ...acc, ...r }), {} as Record<string, AdStatus>);
    },
    enabled: bots.length > 0,
    refetchInterval: 60000,
  });

  // Real-time updates via WebSocket
  useEffect(() => {
    if (!socket) return;

    const onTick = (data: {
      botId: string;
      currentPrice: number;
      activeOrderCount: number;
      priceChanged: boolean;
    }) => {
      qc.setQueryData<Bot[]>(['bots'], (prev = []) =>
        prev.map(b =>
          b.id === data.botId
            ? { ...b, currentPrice: data.currentPrice, lastTickAt: new Date().toISOString() }
            : b
        )
      );
    };

    const onError = () => {
      qc.invalidateQueries({ queryKey: ['bots'] });
    };

    socket.on('bot:tick', onTick);
    socket.on('bot:error', onError);
    return () => {
      socket.off('bot:tick', onTick);
      socket.off('bot:error', onError);
    };
  }, [socket, qc]);

  // Filter bots by selected account
  const filteredBots =
    selectedAccount === 'all'
      ? bots
      : bots.filter(b => b.account.id === selectedAccount);

  const runningCount = filteredBots.filter(b => b.status === 'RUNNING').length;
  const sellCount    = filteredBots.filter(b => adStatuses[b.advNo]?.tradeType === 'SELL').length;
  const buyCount     = filteredBots.filter(b => adStatuses[b.advNo]?.tradeType === 'BUY').length;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Anuncios P2P</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Anuncios activos en Binance P2P
          </p>
        </div>
        <Link href="/bots">
          <button className="text-sm text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-1.5">
            Ir a Bots →
          </button>
        </Link>
      </div>

      {/* Account selector + summary */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">Cuenta:</label>
          <select
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Todas las cuentas</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.label}
              </option>
            ))}
          </select>
        </div>

        {!isLoading && filteredBots.length > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              <span className="text-foreground font-medium">{runningCount}</span> activos
            </span>
            {sellCount > 0 && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                <span className="text-foreground font-medium">{sellCount}</span> venta
              </span>
            )}
            {buyCount > 0 && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                <span className="text-foreground font-medium">{buyCount}</span> compra
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-card border border-border border-l-4 border-l-border rounded-xl p-4 space-y-3 animate-pulse">
              <div className="h-3 bg-muted rounded w-2/3" />
              <div className="h-7 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : filteredBots.length === 0 ? (
        <div className="bg-card border border-border rounded-xl flex items-center justify-center py-20">
          <p className="text-muted-foreground text-sm">
            {selectedAccount === 'all'
              ? 'No hay bots configurados'
              : 'Sin bots para esta cuenta'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBots.map(bot => (
            <AdCard
              key={bot.id}
              bot={bot}
              adStatus={adStatuses[bot.advNo]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
