'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { toast } from 'sonner';
import {
  Plus, Search, Settings, Copy, X, Play, Square, Loader2, AlertTriangle, RefreshCw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Bot {
  id: string;
  advNo: string;
  asset: string;
  fiat: string;
  mode: string;
  status: 'RUNNING' | 'STOPPED' | 'ERROR' | 'PAUSED';
  currentPrice?: number;
  marketPrice?: number;
  currentPosition?: number;
  diffPercent?: number;
  activeOrdersCount?: number;
  lastTickAt?: string;
  lastError?: string;
  label?: string;
  tradeType?: string;
  account: { id: string; label: string };
}

interface Account {
  id: string;
  label: string;
  isActive: boolean;
}

interface Ad {
  advNo: string;
  asset: string;
  fiatUnit: string;
  tradeType: string;
  price: string;
  surplusAmount: string;
  minSingleTransAmount: string;
  maxSingleTransAmount: string;
  payMethods: string[];
  status: string;
  advStatus: number;
  label: string;
  priceScale: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function diffStr(diff: number | null | undefined) {
  if (diff == null) return '—';
  return (diff > 0 ? '+' : '') + diff.toFixed(4) + '%';
}

function diffColor(diff: number | null | undefined) {
  if (diff == null) return 'text-muted-foreground';
  return diff >= 0 ? 'text-green-400' : 'text-red-400';
}

function elapsed(dateStr?: string) {
  if (!dateStr) return 'nunca';
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
  return `hace ${Math.floor(s / 3600)}h`;
}

// ─── Bot Card ─────────────────────────────────────────────────────────────────

function BotCard({
  bot, onStop, onStart, onClone, onDelete, loading, onQuickSave,
}: {
  bot: Bot;
  onStop: (id: string) => void;
  onStart: (id: string) => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
  loading: string | null;
  onQuickSave: (id: string, config: Record<string, any>) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const cfg = (bot as any).config || {};
  const [qFloor, setQFloor] = useState(String(cfg.price_floor ?? cfg.minPrice ?? ''));
  const [qCeil, setQCeil] = useState(String(cfg.price_ceil ?? cfg.maxPrice ?? ''));
  const [qInc, setQInc] = useState(String(cfg.increment ?? cfg.spreadVes ?? '0.005'));
  const [qRivalMin, setQRivalMin] = useState(String(cfg.rival_min_max ?? '0'));
  const [qSurplusMin, setQSurplusMin] = useState(String(cfg.surplus_min ?? '0'));
  const [qSaving, setQSaving] = useState(false);

  const tradeType = bot.tradeType || cfg.tradeType || 'SELL';
  const isBuy = tradeType === 'BUY';
  const running = bot.status === 'RUNNING';
  const hasError = !!bot.lastError;

  const borderColor = isBuy ? 'border-green-500' : 'border-red-500';
  const bgGradient = isBuy
    ? 'bg-gradient-to-br from-green-500/18 via-green-500/4 to-transparent'
    : 'bg-gradient-to-br from-red-500/18 via-red-500/4 to-transparent';
  const errorRing = hasError ? 'ring-2 ring-red-500/60' : '';

  return (
    <div className={`rounded-2xl border-2 ${borderColor} ${bgGradient} ${errorRing} overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-2xl`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <p className="font-bold text-base text-foreground leading-tight">
          {bot.label || (bot as any).config?.label || `${bot.asset}/${bot.fiat} ${tradeType}`}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {/* Trade type badge */}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isBuy ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {tradeType}
          </span>
          {/* Mode badge */}
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/40">
            {bot.mode}
          </span>
          {/* Status badge */}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
            running
              ? 'bg-green-500/20 text-green-400 border border-green-500/40'
              : 'bg-white/7 text-muted-foreground border border-white/12'
          }`}>
            <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${
              running ? 'bg-green-400 animate-pulse shadow-[0_0_8px_theme(colors.green.400)]' : 'bg-muted-foreground'
            }`} />
            {running ? 'Activo' : 'Detenido'}
          </span>
          {/* Error badge */}
          {hasError && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500 text-white" title={bot.lastError}>
              ⚠ Error
            </span>
          )}
        </div>
      </div>

      {/* Stats grid — 4 columns */}
      <div className="grid grid-cols-4 border-t border-white/10">
        <div className="px-3 py-2.5">
          <p className="font-extrabold text-sm text-foreground">{fmt(bot.currentPrice)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Mi precio</p>
        </div>
        <div className="px-3 py-2.5">
          <p className="font-extrabold text-sm text-foreground">{fmt(bot.marketPrice)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Mercado</p>
        </div>
        <div className="px-3 py-2.5">
          <p className="font-extrabold text-sm text-foreground">{bot.currentPosition ?? '—'}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Pos.</p>
        </div>
        <div className="px-3 py-2.5">
          <p className={`font-extrabold text-sm ${diffColor(bot.diffPercent)}`}>{diffStr(bot.diffPercent)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Diff</p>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-t border-white/8 bg-black/25">
        {/* Config */}
        <button
          onClick={() => router.push(`/bots/${bot.id}`)}
          className="w-9 h-9 rounded-full border border-slate-400/35 bg-slate-400/10 text-slate-400 flex items-center justify-center hover:bg-slate-400/25 hover:text-white hover:scale-105 transition-all"
          title="Configurar"
        >
          <Settings size={14} />
        </button>

        {/* Start/Stop */}
        {running ? (
          <Button
            size="sm"
            variant="destructive"
            className="flex-1 text-xs h-9"
            onClick={() => onStop(bot.id)}
            disabled={loading === bot.id}
          >
            {loading === bot.id ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} />}
            <span className="ml-1">Detener</span>
          </Button>
        ) : (
          <Button
            size="sm"
            className="flex-1 text-xs h-9 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => onStart(bot.id)}
            disabled={loading === bot.id}
          >
            {loading === bot.id ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            <span className="ml-1">Iniciar</span>
          </Button>
        )}

        {/* Clone */}
        <button
          onClick={() => onClone(bot.id)}
          className="w-9 h-9 rounded-full border border-sky-500/35 bg-sky-500/10 text-sky-400 flex items-center justify-center hover:bg-sky-500/30 hover:text-white hover:scale-105 transition-all"
          title="Clonar bot"
        >
          <Copy size={14} />
        </button>

        {/* Delete */}
        <button
          onClick={() => {
            if (window.confirm('¿Eliminar este bot? Se detendrá si está activo.')) onDelete(bot.id);
          }}
          className="w-9 h-9 rounded-full border border-red-500/35 bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/35 hover:text-white hover:scale-105 transition-all"
          title="Eliminar"
        >
          <X size={14} />
        </button>
      </div>

      {/* Subinfo + expand toggle */}
      <div className="px-4 py-1.5 text-[10px] text-muted-foreground border-t border-white/5 flex justify-between items-center">
        <span>{bot.account.label}</span>
        <div className="flex items-center gap-2">
          <span>Tick: {elapsed(bot.lastTickAt)}</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-primary hover:text-primary/80 text-[10px] font-semibold"
          >
            {expanded ? '▲ Cerrar' : '▼ Edición rápida'}
          </button>
        </div>
      </div>

      {/* Quick edit panel */}
      {expanded && (
        <div className="px-4 py-3 border-t border-white/15 space-y-3" style={{ background: '#0a0a14' }}>
          <p className="text-[10px] font-semibold text-white/70 uppercase tracking-wider">Edición rápida</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-white/50 block mb-1">🔻 Piso</label>
              <input type="number" step="0.001" value={qFloor} onChange={e => setQFloor(e.target.value)}
                className="w-full rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-primary/60"
                style={{ background: '#151520', border: '1px solid rgba(255,255,255,0.12)' }} />
            </div>
            <div>
              <label className="text-[10px] text-white/50 block mb-1">🔺 Techo</label>
              <input type="number" step="0.001" value={qCeil} onChange={e => setQCeil(e.target.value)}
                className="w-full rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-primary/60"
                style={{ background: '#151520', border: '1px solid rgba(255,255,255,0.12)' }} />
            </div>
            <div>
              <label className="text-[10px] text-white/50 block mb-1">⚡ Incremento</label>
              <input type="number" step="0.001" value={qInc} onChange={e => setQInc(e.target.value)}
                className="w-full rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-primary/60"
                style={{ background: '#151520', border: '1px solid rgba(255,255,255,0.12)' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/50 block mb-1">🎯 Ignorar rivales con mín mayor a (fiat)</label>
              <input type="number" step="1" value={qRivalMin} onChange={e => setQRivalMin(e.target.value)} placeholder="0 = sin filtro"
                className="w-full rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-primary/60"
                style={{ background: '#151520', border: '1px solid rgba(255,255,255,0.12)' }} />
              <p className="text-[8px] text-white/30 mt-0.5">Solo compite con rivales que acepten montos pequeños</p>
            </div>
            <div>
              <label className="text-[10px] text-white/50 block mb-1">📦 USDT mínimo en stock del rival</label>
              <input type="number" step="0.01" value={qSurplusMin} onChange={e => setQSurplusMin(e.target.value)} placeholder="0 = sin filtro"
                className="w-full rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-primary/60"
                style={{ background: '#151520', border: '1px solid rgba(255,255,255,0.12)' }} />
              <p className="text-[8px] text-white/30 mt-0.5">Ignora rivales con menos USDT disponible</p>
            </div>
          </div>
          <button
            onClick={async () => {
              setQSaving(true);
              const updates: Record<string, any> = {};
              if (qFloor) updates.price_floor = parseFloat(qFloor);
              if (qCeil) updates.price_ceil = parseFloat(qCeil);
              if (qInc) updates.increment = parseFloat(qInc);
              updates.price_limit_enabled = !!(qFloor || qCeil);
              updates.rival_min_max = parseFloat(qRivalMin) || 0;
              updates.surplus_min = parseFloat(qSurplusMin) || 0;
              onQuickSave(bot.id, updates);
              setQSaving(false);
            }}
            disabled={qSaving}
            className="w-full py-2 text-xs rounded-lg font-semibold transition-colors disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, rgba(104,87,255,0.8), rgba(80,60,220,0.8))', color: 'white' }}
          >
            {qSaving ? 'Guardando...' : '✓ Guardar cambios rápidos'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Create Bot Modal ─────────────────────────────────────────────────────────

function CreateBotModal({
  accounts,
  onClose,
}: {
  accounts: Account[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [ads, setAds] = useState<Ad[]>([]);
  const [selectedAdvNo, setSelectedAdvNo] = useState('');
  const [adsLoading, setAdsLoading] = useState(false);
  const [adsError, setAdsError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualAdvNo, setManualAdvNo] = useState('');
  const [manualAsset, setManualAsset] = useState('USDT');
  const [manualFiat, setManualFiat] = useState('VES');
  const [manualTradeType, setManualTradeType] = useState<'BUY' | 'SELL'>('SELL');
  const [registerAdvNo, setRegisterAdvNo] = useState('');
  const [creating, setCreating] = useState(false);

  // Load ads when account changes
  useEffect(() => {
    if (!accountId) return;
    loadAds();
  }, [accountId]);

  async function loadAds(force = false) {
    setAdsLoading(true);
    setAdsError('');
    try {
      const { data } = await api.get(`/bots/accounts/${accountId}/ads${force ? '?refresh=1' : ''}`);
      setAds(Array.isArray(data) ? data : []);
      if (!data.length) setAdsError('Sin anuncios encontrados — usa modo manual');
    } catch {
      setAdsError('No se pudo conectar con Binance. Usa modo manual.');
    } finally {
      setAdsLoading(false);
    }
  }

  async function handleRegisterAdvNo() {
    if (!registerAdvNo.trim() || !/^\d+$/.test(registerAdvNo.trim())) {
      toast.error('Ingresa un número de anuncio válido');
      return;
    }
    try {
      await api.post(`/bots/accounts/${accountId}/ads/register`, { adv_no: registerAdvNo.trim() });
      setRegisterAdvNo('');
      loadAds(true);
      toast.success('AdvNo registrado');
    } catch {
      toast.error('Error al registrar anuncio');
    }
  }

  async function goToConfig() {
    setCreating(true);
    try {
      let botData: Record<string, any>;

      if (manualMode) {
        if (!manualAdvNo.trim()) { toast.error('Ingresa el AdvNo'); setCreating(false); return; }
        botData = {
          accountId,
          advNo: manualAdvNo.trim(),
          asset: manualAsset,
          fiat: manualFiat,
          tradeType: manualTradeType,
        };
      } else {
        if (!selectedAdvNo) { toast.error('Selecciona un anuncio'); setCreating(false); return; }
        const ad = ads.find(a => a.advNo === selectedAdvNo);
        botData = {
          accountId,
          advNo: selectedAdvNo,
          asset: ad?.asset || 'USDT',
          fiat: ad?.fiatUnit || 'VES',
          tradeType: ad?.tradeType || 'SELL',
        };
      }

      const { data } = await api.post('/bots', botData);
      toast.success('Bot creado');
      onClose();
      router.push(`/bots/${data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al crear bot');
    } finally {
      setCreating(false);
    }
  }

  const inputStyle = 'w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all';
  const labelStyle = 'text-xs text-muted-foreground font-medium mb-1.5 block';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#111827] border border-primary/20 rounded-2xl p-5 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-5">🤖 Nuevo Bot</h3>

        {/* Account selector */}
        <div className="mb-4">
          <label className={labelStyle}>Cuenta Binance</label>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inputStyle}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>

        {!manualMode ? (
          <>
            {/* Ad selector */}
            <div className="mb-4">
              <label className={labelStyle + ' flex items-center justify-between'}>
                <span>Anuncio a gestionar</span>
                <button onClick={() => loadAds(true)} className="text-primary text-[11px] hover:underline flex items-center gap-1">
                  <RefreshCw size={10} /> Recargar
                </button>
              </label>
              <select
                value={selectedAdvNo}
                onChange={e => setSelectedAdvNo(e.target.value)}
                disabled={adsLoading}
                className={inputStyle}
              >
                <option value="">{adsLoading ? 'Cargando...' : `— Selecciona un anuncio (${ads.length}) —`}</option>
                {ads.map(a => (
                  <option key={a.advNo} value={a.advNo}>
                    {a.label || `${a.asset}/${a.fiatUnit} ${a.tradeType}`} [{a.status}]
                  </option>
                ))}
              </select>

              {/* Register advNo manually */}
              <div className="flex gap-1.5 mt-1.5">
                <input
                  value={registerAdvNo}
                  onChange={e => setRegisterAdvNo(e.target.value)}
                  placeholder="AdvNo (si no aparece tu anuncio)"
                  className="flex-1 text-xs px-2 py-1 bg-[#1a1d2e] border border-[#2d3348] text-foreground rounded"
                />
                <button
                  onClick={handleRegisterAdvNo}
                  className="text-[11px] px-2.5 py-1 bg-primary text-black font-semibold rounded whitespace-nowrap hover:opacity-90"
                >
                  + Agregar
                </button>
              </div>

              {adsError && (
                <p className="text-xs text-muted-foreground mt-2">
                  {adsError}{' '}
                  <button onClick={() => setManualMode(true)} className="text-primary hover:underline">
                    Ingresar manualmente →
                  </button>
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Manual mode */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 text-xs text-muted-foreground">
              💡 Ingresa los datos de tu anuncio de Binance P2P. El número de anuncio lo encuentras en{' '}
              <strong className="text-foreground">Binance → C2C → Mis Anuncios</strong>.
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelStyle}>Activo</label>
                <select value={manualAsset} onChange={e => setManualAsset(e.target.value)} className={inputStyle}>
                  <option value="USDT">USDT</option>
                  <option value="BTC">BTC</option>
                  <option value="ETH">ETH</option>
                  <option value="BNB">BNB</option>
                </select>
              </div>
              <div>
                <label className={labelStyle}>Moneda fiat</label>
                <input value={manualFiat} onChange={e => setManualFiat(e.target.value.toUpperCase())} className={inputStyle} placeholder="VES, COP, USD..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelStyle}>Tipo</label>
                <select value={manualTradeType} onChange={e => setManualTradeType(e.target.value as 'BUY' | 'SELL')} className={inputStyle}>
                  <option value="BUY">COMPRA (BUY)</option>
                  <option value="SELL">VENTA (SELL)</option>
                </select>
              </div>
              <div>
                <label className={labelStyle}>Número de anuncio</label>
                <input value={manualAdvNo} onChange={e => setManualAdvNo(e.target.value)} className={inputStyle} placeholder="11481953735..." />
              </div>
            </div>
            <button onClick={() => setManualMode(false)} className="text-xs text-primary hover:underline mb-3 block">
              ← Intentar cargar automáticamente
            </button>
          </>
        )}

        {/* Footer */}
        <div className="flex gap-2.5 mt-5">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={creating}>
            Cancelar
          </Button>
          <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={goToConfig} disabled={creating}>
            {creating ? 'Creando...' : 'Configurar →'}
          </Button>
        </div>
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
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Re-render every 10s for elapsed timestamps
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

  // Real-time WebSocket updates
  useEffect(() => {
    if (!socket) return;
    const onTick = (data: any) => {
      qc.setQueryData<Bot[]>(['bots'], (prev = []) =>
        prev.map(b =>
          b.id === data.botId
            ? {
                ...b,
                currentPrice: data.currentPrice ?? b.currentPrice,
                marketPrice: data.marketPrice ?? b.marketPrice,
                currentPosition: data.currentPosition ?? b.currentPosition,
                diffPercent: data.diffPercent ?? b.diffPercent,
                lastTickAt: new Date().toISOString(),
              }
            : b
        )
      );
    };
    const onError = () => qc.invalidateQueries({ queryKey: ['bots'] });
    socket.on('bot:tick', onTick);
    socket.on('bot:error', onError);
    return () => { socket.off('bot:tick', onTick); socket.off('bot:error', onError); };
  }, [socket, qc]);

  // Actions
  async function doAction(action: string, botId: string) {
    setActionLoading(botId);
    try {
      if (action === 'start') await api.post(`/bots/${botId}/start`);
      else if (action === 'stop') await api.post(`/bots/${botId}/stop`);
      else if (action === 'clone') await api.post(`/bots/${botId}/clone`);
      else if (action === 'delete') await api.delete(`/bots/${botId}`);
      toast.success(action === 'start' ? 'Bot iniciado' : action === 'stop' ? 'Bot detenido' : action === 'clone' ? 'Bot clonado' : 'Bot eliminado');
      qc.invalidateQueries({ queryKey: ['bots'] });
    } catch {
      toast.error(`Error al ${action === 'start' ? 'iniciar' : action === 'stop' ? 'detener' : action === 'clone' ? 'clonar' : 'eliminar'} bot`);
    } finally {
      setActionLoading(null);
    }
  }

  async function startAll() {
    setActionLoading('all');
    try {
      const res = await api.post('/bots/start-all');
      toast.success(`${res.data.started} bots iniciados`);
      qc.invalidateQueries({ queryKey: ['bots'] });
    } catch { toast.error('Error al iniciar todos'); }
    finally { setActionLoading(null); }
  }

  async function stopAll() {
    setActionLoading('all');
    try {
      const res = await api.post('/bots/stop-all');
      toast.success(`${res.data.stopped} bots detenidos`);
      qc.invalidateQueries({ queryKey: ['bots'] });
    } catch { toast.error('Error al detener todos'); }
    finally { setActionLoading(null); }
  }

  // Filter
  const filtered = bots.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    const key = `${b.label || ''} ${b.asset} ${b.fiat} ${b.tradeType || ''} ${b.mode} ${b.advNo}`.toLowerCase();
    return key.includes(q);
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Mis Bots</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{bots.length} bots</span>

          {/* Search toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <Search size={15} />
          </button>

          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={startAll} disabled={actionLoading === 'all'}>
            <Play size={13} /> Todos
          </Button>
          <Button size="sm" variant="destructive" onClick={stopAll} disabled={actionLoading === 'all'}>
            <Square size={13} /> Todos
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              if (!accounts.length) {
                toast.error('Primero agrega una cuenta Binance');
                return;
              }
              setShowCreate(true);
            }}
          >
            <Plus size={15} /> Nuevo bot
          </Button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, moneda o tipo..."
            className="w-full bg-white/6 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
            autoFocus
          />
        </div>
      )}

      {/* Empty state */}
      {bots.length === 0 && (
        <div className="text-center py-16">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Sin bots configurados</h3>
          <p className="text-sm text-muted-foreground">Crea tu primer bot para empezar a operar en Binance P2P.</p>
        </div>
      )}

      {/* Bot grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filtered.map(bot => (
          <BotCard
            key={bot.id}
            bot={bot}
            onStop={id => doAction('stop', id)}
            onStart={id => doAction('start', id)}
            onClone={id => doAction('clone', id)}
            onDelete={id => doAction('delete', id)}
            loading={actionLoading}
            onQuickSave={async (id, updates) => {
              try {
                const current = (bot as any).config || {};
                const newConfig = { ...current, ...updates };
                await api.put(`/bots/${id}`, { mode: bot.mode, riskProfile: (bot as any).riskProfile, config: newConfig });
                toast.success('Config actualizada');
                qc.invalidateQueries({ queryKey: ['bots'] });
              } catch { toast.error('Error al guardar'); }
            }}
          />
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateBotModal
          accounts={accounts}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
