'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp } from 'lucide-react';

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

interface PriceTick { price: number; createdAt: string; action?: string; }

const MODES = [
  { value: 'POSITION', label: 'Posición', desc: 'Compite por una posición específica en el mercado' },
  { value: 'PRICE',    label: 'Precio fijo', desc: 'Mantiene un precio fijo definido' },
  { value: 'DYNAMIC',  label: 'Dinámico', desc: 'Ajuste automático con spread sobre el mejor precio' },
  { value: 'SMART',    label: 'Smart', desc: 'Balanceo inteligente entre posición y precio' },
  { value: 'FLOAT',    label: 'Flotante', desc: 'Sigue el mercado con spread configurable' },
];

const RISK_PROFILES = [
  { value: 'AGGRESSIVE',   label: 'Agresivo',   desc: 'Undercut más agresivo, mayor volumen' },
  { value: 'MODERATE',     label: 'Moderado',   desc: 'Balance entre precio y volumen' },
  { value: 'CONSERVATIVE', label: 'Conservador', desc: 'Prioriza margen sobre volumen' },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm text-muted-foreground block mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function NumberInput({
  value, onChange, placeholder, step = '0.01', min, max,
}: { value: string; onChange: (v: string) => void; placeholder?: string; step?: string; min?: string; max?: string }) {
  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}

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

  // Core settings
  const [mode, setMode] = useState('POSITION');
  const [riskProfile, setRiskProfile] = useState('MODERATE');

  // Mode-specific fields (all as strings for input binding)
  const [targetPosition, setTargetPosition] = useState('1');
  const [fixedPrice, setFixedPrice] = useState('');
  const [spreadVes, setSpreadVes] = useState('0.01');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [intervalSec, setIntervalSec] = useState('8');

  // Advanced JSON fallback
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [configJson, setConfigJson] = useState('{}');
  const [jsonError, setJsonError] = useState('');

  // Restart on save
  const [restartOnSave, setRestartOnSave] = useState(false);

  // Manual price
  const [manualPrice, setManualPrice] = useState('');

  // Sync form from bot data on load
  useEffect(() => {
    if (!bot) return;
    setMode(bot.mode ?? 'POSITION');
    setRiskProfile(bot.riskProfile ?? 'MODERATE');
    const c = (bot.config ?? {}) as Record<string, unknown>;
    if (c.targetPosition != null)  setTargetPosition(String(c.targetPosition));
    if (c.fixedPrice != null)      setFixedPrice(String(c.fixedPrice));
    if (c.spreadVes != null)       setSpreadVes(String(c.spreadVes));
    if (c.minPrice != null)        setMinPrice(String(c.minPrice));
    if (c.maxPrice != null)        setMaxPrice(String(c.maxPrice));
    if (c.intervalMs != null)      setIntervalSec(String(Math.round(Number(c.intervalMs) / 1000)));
    else if (c.intervalSec != null) setIntervalSec(String(c.intervalSec));
    setConfigJson(JSON.stringify(c, null, 2));
  }, [bot]);

  // Build config object from guided fields
  function buildConfig(): Record<string, unknown> {
    const cfg: Record<string, unknown> = {};
    const pos = parseInt(targetPosition);
    const sprd = parseFloat(spreadVes);
    const fp = parseFloat(fixedPrice);
    const mn = parseFloat(minPrice);
    const mx = parseFloat(maxPrice);
    const iv = parseInt(intervalSec);

    if (mode === 'POSITION' || mode === 'SMART') {
      if (!isNaN(pos)) cfg.targetPosition = pos;
    }
    if (mode === 'PRICE') {
      if (!isNaN(fp)) cfg.fixedPrice = fp;
    }
    if (mode !== 'PRICE') {
      if (!isNaN(sprd)) cfg.spreadVes = sprd;
    }
    if (!isNaN(mn) && minPrice !== '') cfg.minPrice = mn;
    if (!isNaN(mx) && maxPrice !== '') cfg.maxPrice = mx;
    if (!isNaN(iv) && iv > 0) cfg.intervalMs = iv * 1000;
    return cfg;
  }

  const saveConfig = useMutation({
    mutationFn: () => {
      const config = showAdvanced ? (() => {
        try { return JSON.parse(configJson); }
        catch { throw new Error('JSON inválido'); }
      })() : buildConfig();
      return api.put(`/bots/${botId}`, { mode, riskProfile, config });
    },
    onSuccess: async () => {
      toast.success('Configuración guardada');
      qc.invalidateQueries({ queryKey: ['bots', botId] });
      qc.invalidateQueries({ queryKey: ['bots'] });

      if (restartOnSave && bot?.status === 'RUNNING') {
        try {
          await api.post(`/bots/${botId}/stop`);
          await api.post(`/bots/${botId}/start`);
          toast.success('Bot reiniciado con nueva configuración');
          qc.invalidateQueries({ queryKey: ['bots', botId] });
          qc.invalidateQueries({ queryKey: ['bots'] });
        } catch {
          toast.error('Config guardada pero no se pudo reiniciar el bot');
        }
      }
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
    try { JSON.parse(value); setJsonError(''); }
    catch { setJsonError('JSON inválido'); }
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Cargando...</div>;
  if (error || !bot) return <div className="p-6 text-red-400">Bot no encontrado</div>;

  const isRunning = bot.status === 'RUNNING';
  const currentPrice = history.length > 0
    ? Number(history[history.length - 1].price)
    : (bot.currentPrice ?? null);

  const statusColor = {
    RUNNING: 'text-green-400',
    STOPPED: 'text-muted-foreground',
    ERROR:   'text-red-400',
    PAUSED:  'text-yellow-400',
  }[bot.status] ?? 'text-muted-foreground';

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <button
        onClick={() => router.push('/bots')}
        className="text-sm text-muted-foreground hover:text-foreground mb-6 flex items-center gap-1"
      >
        ← Volver a Bots
      </button>

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">Config Bot</h1>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
          isRunning ? 'border-green-500/40 bg-green-500/10 text-green-400'
          : bot.status === 'ERROR' ? 'border-red-500/40 bg-red-500/10 text-red-400'
          : 'border-border bg-secondary text-muted-foreground'
        }`}>
          {bot.status}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        advNo: <span className="font-mono text-foreground">{bot.advNo}</span> · Cuenta:{' '}
        <span className="text-foreground">{bot.account.label}</span>
        {currentPrice !== null && (
          <> · Precio: <span className="font-mono text-primary">{currentPrice.toLocaleString('es-VE', { minimumFractionDigits: 2 })} VES</span></>
        )}
      </p>

      {bot.lastError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
          {bot.lastError}
        </div>
      )}

      {/* === Config form === */}
      <div className="space-y-5 bg-card border border-border rounded-lg p-5 mb-6">
        <h2 className="font-medium">Motor de precio</h2>

        {/* Mode selector */}
        <Field label="Modo de precio">
          <div className="grid grid-cols-1 gap-2">
            {MODES.map(m => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`flex items-start gap-3 px-3 py-2.5 rounded border text-left transition-colors ${
                  mode === m.value
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                <span className={`mt-0.5 text-xs font-bold rounded px-1.5 py-0.5 shrink-0 ${
                  mode === m.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                }`}>{m.value}</span>
                <div>
                  <span className="text-sm font-medium">{m.label}</span>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Field>

        {/* Risk profile */}
        <Field label="Perfil de riesgo">
          <div className="flex gap-2">
            {RISK_PROFILES.map(r => (
              <button
                key={r.value}
                onClick={() => setRiskProfile(r.value)}
                title={r.desc}
                className={`flex-1 px-3 py-2 rounded border text-sm transition-colors ${
                  riskProfile === r.value
                    ? 'border-primary bg-primary/10 text-foreground font-medium'
                    : 'border-border bg-secondary text-muted-foreground hover:border-primary/40'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="border-t border-border pt-4 space-y-4">
          {/* POSITION mode: target position */}
          {(mode === 'POSITION' || mode === 'SMART') && (
            <Field
              label="Posición objetivo"
              hint="1 = el precio más bajo del mercado (más competitivo). 2 = segundo más bajo, etc."
            >
              <NumberInput
                value={targetPosition}
                onChange={setTargetPosition}
                placeholder="1"
                step="1"
                min="1"
                max="20"
              />
            </Field>
          )}

          {/* PRICE/fixed mode: fixed price */}
          {mode === 'PRICE' && (
            <Field
              label="Precio fijo (VES)"
              hint="El bot mantendrá exactamente este precio en el anuncio."
            >
              <NumberInput value={fixedPrice} onChange={setFixedPrice} placeholder="649.00" />
            </Field>
          )}

          {/* Spread — all modes except PRICE */}
          {mode !== 'PRICE' && (
            <Field
              label="Spread (VES)"
              hint="Cuánto por debajo del competidor de referencia se pone el precio (default: 0.01)."
            >
              <NumberInput value={spreadVes} onChange={setSpreadVes} placeholder="0.01" />
            </Field>
          )}

          {/* Price floor and ceiling */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Precio mínimo (VES)" hint="Límite de seguridad inferior. Vacío = sin límite.">
              <NumberInput value={minPrice} onChange={setMinPrice} placeholder="600.00" />
            </Field>
            <Field label="Precio máximo (VES)" hint="Límite de seguridad superior. Vacío = sin límite.">
              <NumberInput value={maxPrice} onChange={setMaxPrice} placeholder="700.00" />
            </Field>
          </div>

          {/* Interval */}
          <Field label="Intervalo de tick (segundos)" hint="Cada cuántos segundos el bot actualiza el precio (mínimo 5s).">
            <NumberInput value={intervalSec} onChange={setIntervalSec} placeholder="8" step="1" min="5" />
          </Field>
        </div>

        {/* Advanced JSON toggle */}
        <div className="border-t border-border pt-4">
          <button
            onClick={() => {
              if (!showAdvanced) setConfigJson(JSON.stringify(buildConfig(), null, 2));
              setShowAdvanced(v => !v);
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            JSON avanzado
          </button>
          {showAdvanced && (
            <div className="mt-3">
              <textarea
                value={configJson}
                onChange={e => validateJson(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm font-mono text-foreground h-40 focus:outline-none focus:border-primary resize-none"
                placeholder="{}"
              />
              {jsonError && <p className="text-xs text-red-400 mt-1">{jsonError}</p>}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          {isRunning && (
            <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
              <input
                type="checkbox"
                checked={restartOnSave}
                onChange={e => setRestartOnSave(e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm text-muted-foreground">
                Reiniciar bot al guardar
              </span>
            </label>
          )}
          <div className="flex gap-3">
            <Button
              onClick={() => saveConfig.mutate()}
              disabled={saveConfig.isPending || (showAdvanced && !!jsonError)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saveConfig.isPending ? (restartOnSave && isRunning ? 'Guardando y reiniciando...' : 'Guardando...') : 'Guardar configuración'}
            </Button>
            <Button
              onClick={() => toggleBot.mutate()}
              disabled={toggleBot.isPending || saveConfig.isPending}
              variant={isRunning ? 'destructive' : 'secondary'}
            >
              {toggleBot.isPending ? 'Procesando...' : isRunning ? '■ Detener' : '▶ Iniciar'}
            </Button>
          </div>
        </div>
      </div>

      {/* Manual price override */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3 mb-6">
        <div>
          <h3 className="font-semibold">Precio manual</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aplica un precio puntual al anuncio ahora mismo. No cambia el modo del bot.
          </p>
        </div>
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
