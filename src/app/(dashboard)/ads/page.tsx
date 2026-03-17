'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSocket } from '@/lib/socket';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'RUNNING') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
        Activo
      </span>
    );
  }
  if (status === 'ERROR') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400 border border-red-500/30">
        <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
        Error
      </span>
    );
  }
  if (status === 'PAUSED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
        Pausado
      </span>
    );
  }
  // STOPPED (default)
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-400 border border-gray-500/30">
      <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" />
      Detenido
    </span>
  );
}

// ─── Mode Badge ───────────────────────────────────────────────────────────────

function ModeBadge({ mode }: { mode: string }) {
  const styles: Record<string, string> = {
    DYNAMIC: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    FIXED: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
    SPREAD: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  };
  const style = styles[mode] ?? styles['FIXED'];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${style}`}>
      {mode}
    </span>
  );
}

// ─── AdvNo Cell (copyable) ────────────────────────────────────────────────────

function AdvNoCell({ advNo }: { advNo: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(advNo).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar advNo"
      className="font-mono text-sm text-foreground hover:text-primary transition-colors relative group"
    >
      {advNo}
      <span
        className={`ml-2 text-xs text-green-400 transition-opacity duration-200 ${
          copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
        }`}
      >
        {copied ? 'Copiado!' : 'Copiar'}
      </span>
    </button>
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

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Anuncios P2P</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Anuncios configurados en Binance P2P
          </p>
        </div>
        <Link href="/bots">
          <Button variant="outline" size="sm">
            Ir a Bots →
          </Button>
        </Link>
      </div>

      {/* Account selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground whitespace-nowrap">
          Cuenta:
        </label>
        <select
          value={selectedAccount}
          onChange={e => setSelectedAccount(e.target.value)}
          className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">Todas las cuentas</option>
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {acc.label}
            </option>
          ))}
        </select>
      </div>

      {/* Summary bar */}
      {!isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
          <span>
            <span className="text-foreground font-medium">{runningCount}</span>{' '}
            activos de{' '}
            <span className="text-foreground font-medium">{filteredBots.length}</span>{' '}
            total
          </span>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground text-sm">Cargando anuncios...</p>
        </div>
      ) : filteredBots.length === 0 ? (
        <div className="bg-card border border-border rounded-xl flex items-center justify-center py-16">
          <p className="text-muted-foreground text-sm">
            {selectedAccount === 'all'
              ? 'No hay bots configurados'
              : 'Sin bots para esta cuenta'}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  advNo
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Cuenta
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Estado
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Modo
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Precio actual
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Último tick
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredBots.map(bot => (
                <tr
                  key={bot.id}
                  className="border-t border-border hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <AdvNoCell advNo={bot.advNo} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {bot.account.label}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={bot.status} />
                  </td>
                  <td className="px-4 py-3">
                    <ModeBadge mode={bot.mode} />
                  </td>
                  <td className="px-4 py-3">
                    {bot.currentPrice != null ? (
                      <span className="text-primary font-medium">
                        {fmt(bot.currentPrice)} VES
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {relativeTime(bot.lastTickAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
