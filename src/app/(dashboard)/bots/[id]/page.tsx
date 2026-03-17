'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Bot {
  id: string;
  advNo: string;
  status: 'RUNNING' | 'STOPPED' | 'ERROR' | 'PAUSED';
  mode: string;
  riskProfile: string;
  config: Record<string, unknown> | null;
  lastError?: string;
  account: { id: string; label: string };
  currentPrice?: number | null;
}

interface PriceTick { price: number; createdAt: string; }

const MODES = ['POSITION', 'PRICE', 'SMART', 'FLOAT'];
const RISK_PROFILES = ['AGGRESSIVE', 'MODERATE', 'CONSERVATIVE'];

function PriceChart({ ticks }: { ticks: PriceTick[] }) {
  if (ticks.length < 2) return <p className="text-sm text-muted-foreground">Sin datos de precio</p>;

  const prices = ticks.map(t => t.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const W = 600, H = 120;

  const points = prices.map((p, i) =>
    `${(i / (prices.length - 1)) * W},${H - ((p - min) / range) * (H - 8) - 4}`
  ).join(' ');

  const first = ticks[0]?.createdAt
    ? new Date(ticks[0].createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
    : '';
  const last = ticks[ticks.length - 1]?.createdAt
    ? new Date(ticks[ticks.length - 1].createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" preserveAspectRatio="none">
        <polyline fill="none" stroke="oklch(0.82 0.165 86)" strokeWidth="2" points={points} />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{first}</span>
        <span>{last}</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min.toLocaleString('es-VE', { minimumFractionDigits: 2 })} VES</span>
        <span>{max.toLocaleString('es-VE', { minimumFractionDigits: 2 })} VES</span>
      </div>
    </div>
  );
}

export default function BotConfigPage() {
  const router = useRouter();
  const params = useParams();
  const botId = params.id as string;
  const qc = useQueryClient();

  const { data: bot, isLoading, error } = useQuery<Bot>({
    queryKey: ['bots', botId],
    queryFn: () => api.get(`/bots/${botId}`).then(r => r.data),
  });

  const { data: history = [] } = useQuery<PriceTick[]>({
    queryKey: ['bots', botId, 'price-history', 100],
    queryFn: () => api.get(`/bots/${botId}/price-history?limit=100`).then(r => r.data),
    refetchInterval: 30000,
  });

  const [mode, setMode] = useState('');
  const [riskProfile, setRiskProfile] = useState('');
  const [configJson, setConfigJson] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  // Initialize form from bot data
  useEffect(() => {
    if (bot) {
      setMode(bot.mode);
      setRiskProfile(bot.riskProfile);
      setConfigJson(bot.config ? JSON.stringify(bot.config, null, 2) : '{}');
    }
  }, [bot]);

  const saveConfig = useMutation({
    mutationFn: () => {
      let config: Record<string, unknown>;
      try {
        config = JSON.parse(configJson);
      } catch {
        throw new Error('JSON inválido');
      }
      return api.put(`/bots/${botId}`, { mode, riskProfile, config });
    },
    onSuccess: () => {
      toast.success('Configuración guardada');
      qc.invalidateQueries({ queryKey: ['bots', botId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleBot = useMutation({
    mutationFn: () => {
      const action = bot?.status === 'RUNNING' ? 'stop' : 'start';
      return api.post(`/bots/${botId}/${action}`);
    },
    onSuccess: () => {
      toast.success(bot?.status === 'RUNNING' ? 'Bot detenido' : 'Bot iniciado');
      qc.invalidateQueries({ queryKey: ['bots', botId] });
      qc.invalidateQueries({ queryKey: ['bots'] });
    },
    onError: () => toast.error('Error al cambiar estado del bot'),
  });

  const updatePrice = useMutation({
    mutationFn: (price: number) => api.post(`/bots/${botId}/update-price`, { price }),
    onSuccess: (res) => {
      toast.success(`Precio actualizado a ${res.data.price} VES`);
      qc.invalidateQueries({ queryKey: ['bots', botId] });
      qc.invalidateQueries({ queryKey: ['bots', botId, 'price-history', 100] });
      setManualPrice('');
    },
    onError: () => toast.error('Error al actualizar precio'),
  });

  const validateJson = (value: string) => {
    setConfigJson(value);
    try {
      JSON.parse(value);
      setJsonError('');
    } catch {
      setJsonError('JSON inválido');
    }
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Cargando...</div>;
  if (error || !bot) return <div className="p-6 text-red-400">Bot no encontrado</div>;

  const isRunning = bot.status === 'RUNNING';

  return (
    <div className="p-6 max-w-2xl">
      {/* Back button */}
      <button
        onClick={() => router.push('/bots')}
        className="text-sm text-muted-foreground hover:text-foreground mb-6 flex items-center gap-1"
      >
        ← Volver a Bots
      </button>

      <h1 className="text-xl font-semibold mb-1">Config Bot</h1>
      <p className="text-sm text-muted-foreground mb-6">
        advNo: {bot.advNo} · Cuenta: {bot.account.label}
      </p>

      {bot.lastError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
          {bot.lastError}
        </div>
      )}

      {/* Form */}
      <div className="space-y-4 bg-card border border-border rounded-lg p-5 mb-6">
        <div>
          <label className="text-sm text-muted-foreground block mb-1">Modo</label>
          <select
            value={mode}
            onChange={e => setMode(e.target.value)}
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground"
          >
            {MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm text-muted-foreground block mb-1">Perfil de riesgo</label>
          <select
            value={riskProfile}
            onChange={e => setRiskProfile(e.target.value)}
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground"
          >
            {RISK_PROFILES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm text-muted-foreground block mb-1">
            Configuración avanzada (JSON)
          </label>
          <textarea
            value={configJson}
            onChange={e => validateJson(e.target.value)}
            className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm font-mono text-foreground h-32 focus:outline-none focus:border-primary resize-none"
            placeholder="{}"
          />
          {jsonError && <p className="text-xs text-red-400 mt-1">{jsonError}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={() => saveConfig.mutate()}
            disabled={saveConfig.isPending || !!jsonError}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saveConfig.isPending ? 'Guardando...' : 'Guardar Config'}
          </Button>
          <Button
            onClick={() => toggleBot.mutate()}
            disabled={toggleBot.isPending}
            variant={isRunning ? 'destructive' : 'secondary'}
          >
            {toggleBot.isPending ? 'Procesando...' : isRunning ? '■ Stop' : '▶ Start'}
          </Button>
        </div>
      </div>

      {/* Manual price update */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3 mb-6">
        <h3 className="font-semibold">Precio manual</h3>
        <p className="text-sm text-muted-foreground">
          Precio actual:{' '}
          <span className="text-foreground font-mono">
            {history.length > 0
              ? Number(history[history.length - 1].price).toLocaleString('es-VE', { minimumFractionDigits: 2 })
              : '—'}{' '}
            VES
          </span>
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.01"
            value={manualPrice}
            onChange={e => setManualPrice(e.target.value)}
            placeholder="649.59"
            className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button
            onClick={() => manualPrice && updatePrice.mutate(parseFloat(manualPrice))}
            disabled={!manualPrice || updatePrice.isPending}
            size="sm"
          >
            {updatePrice.isPending ? 'Aplicando...' : 'Aplicar'}
          </Button>
        </div>
      </div>

      {/* Price history chart */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-medium mb-4">
          Historial de precios ({history.length} ticks)
        </h2>
        <PriceChart ticks={history} />
      </div>
    </div>
  );
}
