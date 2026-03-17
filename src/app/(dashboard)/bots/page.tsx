'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Bot {
  id: string;
  advNo: string;
  status: 'RUNNING' | 'STOPPED' | 'ERROR' | 'PAUSED';
  mode: string;
  currentPrice?: number;
  activeOrdersCount?: number;
  lastTickAt?: string;
  lastError?: string;
  account: { id: string; label: string };
}

interface Account {
  id: string;
  label: string;
  isActive: boolean;
}

interface PriceTick {
  price: number;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    RUNNING: 'bg-green-500/20 text-green-400 border border-green-500/30',
    STOPPED: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
    ERROR: 'bg-red-500/20 text-red-400 border border-red-500/30',
    PAUSED: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  };
  return styles[status] ?? styles['STOPPED'];
}

function elapsed(dateStr?: string) {
  if (!dateStr) return 'nunca';
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
  return `hace ${Math.floor(s / 3600)}h`;
}

function fmt(n: number) {
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ botId }: { botId: string }) {
  const { data: history = [] } = useQuery<PriceTick[]>({
    queryKey: ['bots', botId, 'price-history'],
    queryFn: () => api.get(`/bots/${botId}/price-history?limit=20`).then(r => r.data),
    refetchInterval: 10000,
  });

  if (history.length < 2) return null;

  const prices = history.map(h => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const W = 120, H = 40;
  const points = prices
    .map((p, i) =>
      `${(i / (prices.length - 1)) * W},${H - ((p - min) / range) * (H - 4) - 2}`
    )
    .join(' ');

  return (
    <svg width={W} height={H} className="opacity-70 mt-1">
      <polyline
        fill="none"
        stroke="oklch(0.82 0.165 86)"
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

// ─── Bot Card ─────────────────────────────────────────────────────────────────

interface BotCardProps {
  bot: Bot;
  onStop: (id: string) => void;
  onStart: (id: string) => void;
  onDelete: (id: string) => void;
  stopPending: boolean;
  startPending: boolean;
  deletePending: boolean;
}

function BotCard({ bot, onStop, onStart, onDelete, stopPending, startPending, deletePending }: BotCardProps) {
  const router = useRouter();

  function handleDelete() {
    if (window.confirm('¿Eliminar este bot? Se detendrá si está activo.')) {
      onDelete(bot.id);
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">advNo</p>
          <p className="text-sm font-mono font-medium">{bot.advNo}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(bot.status)}`}>
            {bot.status}
          </span>
          <button
            onClick={handleDelete}
            disabled={deletePending}
            className="p-1 rounded text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors disabled:opacity-50"
            title="Eliminar bot"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Account */}
      <p className="text-sm text-muted-foreground">
        Cuenta: <span className="text-foreground">{bot.account.label}</span>
      </p>

      {/* Price */}
      <div>
        <p className="text-xs text-muted-foreground">Precio actual</p>
        {bot.currentPrice ? (
          <p className="text-lg font-bold text-primary">
            {fmt(bot.currentPrice)} VES/USDT
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
        <Sparkline botId={bot.id} />
      </div>

      {/* Stats */}
      <div className="text-sm">
        <span className="text-muted-foreground">
          Órdenes activas:{' '}
          <span className="text-foreground">{bot.activeOrdersCount ?? '—'}</span>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Último tick: {elapsed(bot.lastTickAt)}
      </p>

      {/* Error */}
      {bot.lastError && (
        <p className="text-xs text-red-400 truncate" title={bot.lastError}>
          {bot.lastError}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-2 border-t border-border">
        {bot.status === 'RUNNING' ? (
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={() => onStop(bot.id)}
            disabled={stopPending}
          >
            ■ Stop
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            onClick={() => onStart(bot.id)}
            disabled={startPending}
          >
            ▶ Start
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => router.push(`/bots/${bot.id}`)}
        >
          ⚙ Config
        </Button>
      </div>
    </div>
  );
}

// ─── Create Bot Modal ─────────────────────────────────────────────────────────

interface CreateBotModalProps {
  accounts: Account[];
  onClose: () => void;
  onCreate: (data: { accountId: string; advNo: string; asset: string; fiat: string }) => void;
  isPending: boolean;
}

function CreateBotModal({ accounts, onClose, onCreate, isPending }: CreateBotModalProps) {
  const [accountId, setAccountId] = useState('');
  const [advNo, setAdvNo] = useState('');
  const [asset, setAsset] = useState('USDT');
  const [fiat, setFiat] = useState('VES');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !advNo.trim()) return;
    onCreate({ accountId, advNo: advNo.trim(), asset, fiat });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-5">Crear Bot</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Cuenta */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Cuenta</label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              required
              className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="" disabled>Seleccionar cuenta...</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.label}
                </option>
              ))}
            </select>
          </div>

          {/* advNo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Número de anuncio (advNo)</label>
            <input
              type="text"
              value={advNo}
              onChange={e => setAdvNo(e.target.value)}
              placeholder="123456789"
              required
              className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">ID del anuncio en Binance P2P</p>
          </div>

          {/* Asset */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Activo</label>
            <select
              value={asset}
              onChange={e => setAsset(e.target.value)}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="USDT">USDT</option>
              <option value="BTC">BTC</option>
              <option value="BNB">BNB</option>
            </select>
          </div>

          {/* Fiat */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Moneda Fiat</label>
            <select
              value={fiat}
              onChange={e => setFiat(e.target.value)}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="VES">VES</option>
              <option value="COP">COP</option>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isPending || !accountId || !advNo.trim()}
            >
              {isPending ? 'Creando...' : 'Crear Bot'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BotsPage() {
  const qc = useQueryClient();
  const socket = useSocket();
  const [_tick, setTick] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  // Re-render every 10s to update "elapsed" timestamps
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const { data: bots = [], isLoading } = useQuery<Bot[]>({
    queryKey: ['bots'],
    queryFn: () => api.get('/bots').then(r => r.data),
    refetchInterval: 15000,
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then(r => r.data),
  });

  // Real-time price + status updates via WebSocket
  useEffect(() => {
    if (!socket) return;

    const onTick = (data: {
      botId: string;
      currentPrice: number | null;
      activeOrderCount: number;
      marketPosition?: number;
      priceChanged?: boolean;
    }) => {
      qc.setQueryData<Bot[]>(['bots'], (prev = []) =>
        prev.map(b =>
          b.id === data.botId
            ? {
                ...b,
                currentPrice: data.currentPrice ?? b.currentPrice,
                lastTickAt: new Date().toISOString(),
              }
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

  const stopBot = useMutation({
    mutationFn: (botId: string) => api.post(`/bots/${botId}/stop`),
    onSuccess: () => {
      toast.success('Bot detenido');
      qc.invalidateQueries({ queryKey: ['bots'] });
    },
    onError: () => toast.error('Error al detener bot'),
  });

  const startBot = useMutation({
    mutationFn: (botId: string) => api.post(`/bots/${botId}/start`),
    onSuccess: () => {
      toast.success('Bot iniciado');
      qc.invalidateQueries({ queryKey: ['bots'] });
    },
    onError: () => toast.error('Error al iniciar bot'),
  });

  const createBot = useMutation({
    mutationFn: (data: { accountId: string; advNo: string; asset: string; fiat: string }) =>
      api.post('/bots', data),
    onSuccess: () => {
      toast.success('Bot creado');
      qc.invalidateQueries({ queryKey: ['bots'] });
      setShowCreate(false);
    },
    onError: () => toast.error('Error al crear bot'),
  });

  const deleteBot = useMutation({
    mutationFn: (botId: string) => api.delete(`/bots/${botId}`),
    onSuccess: () => {
      toast.success('Bot eliminado');
      qc.invalidateQueries({ queryKey: ['bots'] });
    },
    onError: () => toast.error('Error al eliminar bot'),
  });

  const startAll = useMutation({
    mutationFn: () => api.post('/bots/start-all'),
    onSuccess: (res) => {
      toast.success(`${res.data.started} bots iniciados`);
      qc.invalidateQueries({ queryKey: ['bots'] });
    },
    onError: () => toast.error('Error al iniciar todos los bots'),
  });

  const stopAll = useMutation({
    mutationFn: () => api.post('/bots/stop-all'),
    onSuccess: (res) => {
      toast.success(`${res.data.stopped} bots detenidos`);
      qc.invalidateQueries({ queryKey: ['bots'] });
    },
    onError: () => toast.error('Error al detener todos los bots'),
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <p className="text-muted-foreground">Cargando bots...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Bots</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{bots.length} bots</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => startAll.mutate()}
            disabled={startAll.isPending}
          >
            {startAll.isPending ? 'Iniciando...' : '▶ Iniciar todos'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => stopAll.mutate()}
            disabled={stopAll.isPending}
            className="text-destructive border-destructive/50 hover:bg-destructive/10"
          >
            {stopAll.isPending ? 'Deteniendo...' : '⏹ Detener todos'}
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={15} />
            Crear Bot
          </Button>
        </div>
      </div>

      {bots.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          No hay bots configurados
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {bots.map(bot => (
          <BotCard
            key={bot.id}
            bot={bot}
            onStop={id => stopBot.mutate(id)}
            onStart={id => startBot.mutate(id)}
            onDelete={id => deleteBot.mutate(id)}
            stopPending={stopBot.isPending}
            startPending={startBot.isPending}
            deletePending={deleteBot.isPending}
          />
        ))}
      </div>

      {showCreate && (
        <CreateBotModal
          accounts={accounts}
          onClose={() => setShowCreate(false)}
          onCreate={data => createBot.mutate(data)}
          isPending={createBot.isPending}
        />
      )}
    </div>
  );
}
