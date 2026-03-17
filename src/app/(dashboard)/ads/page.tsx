'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

interface Account { id: string; label: string; isActive: boolean; }

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
}

interface Bot {
  id: string;
  advNo: string;
  status: string;
  mode: string;
}

function fmt(n: string | number | null | undefined) {
  if (n == null) return '—';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '—';
  return num.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const inputClass = 'w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60 font-mono';

export default function AdsPage() {
  const qc = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [editAd, setEditAd] = useState<Ad | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editMin, setEditMin] = useState('');
  const [editMax, setEditMax] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then(r => r.data),
  });

  // Auto-select first account
  useEffect(() => {
    if (!selectedAccount && accounts.length > 0) setSelectedAccount(accounts[0].id);
  }, [accounts, selectedAccount]);

  // Fetch ads from Binance for selected account
  const { data: ads = [], isLoading, refetch } = useQuery<Ad[]>({
    queryKey: ['binance-ads', selectedAccount],
    queryFn: () => api.get(`/bots/accounts/${selectedAccount}/ads`).then(r => r.data),
    enabled: !!selectedAccount,
    refetchInterval: 60000,
  });

  // Fetch bots to show which ads have bots
  const { data: bots = [] } = useQuery<Bot[]>({
    queryKey: ['bots'],
    queryFn: () => api.get('/bots').then(r => r.data),
  });

  const botMap = new Map(bots.map(b => [b.advNo, b]));

  async function toggleAd(advNo: string) {
    if (!selectedAccount) return;
    setToggling(advNo);
    try {
      await api.post(`/bots/accounts/${selectedAccount}/ads/${advNo}/toggle`);
      toast.success('Estado del anuncio actualizado');
      refetch();
    } catch {
      toast.error('Error al cambiar estado del anuncio');
    } finally {
      setToggling(null);
    }
  }

  function openEdit(ad: Ad) {
    setEditAd(ad);
    setEditPrice(ad.price || '');
    setEditAmount(ad.surplusAmount || '');
    setEditMin(ad.minSingleTransAmount || '');
    setEditMax(ad.maxSingleTransAmount || '');
    setEditRemarks('');
  }

  async function saveEdit() {
    if (!editAd || !selectedAccount) return;
    setSaving(true);
    try {
      const body: Record<string, any> = { advNo: editAd.advNo };
      if (editPrice) body.price = editPrice;
      if (editAmount) body.initAmount = parseFloat(editAmount);
      if (editMin) body.minSingleTransAmount = parseFloat(editMin);
      if (editMax) body.maxSingleTransAmount = parseFloat(editMax);
      if (editRemarks) body.remarks = editRemarks;
      await api.post(`/bots/accounts/${selectedAccount}/ads/update`, body);
      toast.success('Anuncio actualizado');
      setEditAd(null);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  }

  const sellAds = ads.filter(a => a.tradeType === 'SELL');
  const buyAds = ads.filter(a => a.tradeType === 'BUY');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold">Gestión de Anuncios</h1>
        <button onClick={() => refetch()} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <RefreshCw size={12} /> Recargar
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Tus anuncios P2P en Binance — activa, desactiva y gestiona desde aquí.</p>

      {/* Account selector */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-sm text-muted-foreground">Cuenta:</span>
        <select
          value={selectedAccount}
          onChange={e => setSelectedAccount(e.target.value)}
          className="bg-white/6 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/60"
        >
          {accounts.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">{ads.length} anuncios</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : ads.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <p className="text-muted-foreground">Sin anuncios encontrados para esta cuenta</p>
          <p className="text-xs text-muted-foreground mt-1">Verifica que las API keys tengan permisos de Merchant</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map(ad => {
            const isSell = ad.tradeType === 'SELL';
            const isBuy = ad.tradeType === 'BUY';
            const bot = botMap.get(ad.advNo);
            const isOnline = ad.advStatus === 1;

            return (
              <div
                key={ad.advNo}
                className={`rounded-2xl border-2 overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-2xl ${
                  isSell
                    ? 'border-red-500 bg-gradient-to-br from-red-500/18 via-red-500/4 to-transparent'
                    : 'border-green-500 bg-gradient-to-br from-green-500/18 via-green-500/4 to-transparent'
                }`}
              >
                {/* Header */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${isSell ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                      {isSell ? 'VENTA' : 'COMPRA'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`} />
                      <span className="text-[10px] text-muted-foreground">{ad.status}</span>
                    </div>
                  </div>
                  <p className="font-bold text-lg text-foreground">{ad.asset}/{ad.fiatUnit}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{ad.advNo}</p>
                </div>

                {/* Price */}
                <div className="px-4 pb-3">
                  <p className={`text-2xl font-bold ${isSell ? 'text-red-400' : 'text-green-400'}`}>
                    {fmt(ad.price)}
                  </p>
                  <p className="text-xs text-muted-foreground">{ad.fiatUnit}/USDT</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 border-t border-white/10 text-center">
                  <div className="px-3 py-2 border-r border-white/10">
                    <p className="text-xs font-bold text-foreground">{fmt(ad.surplusAmount)}</p>
                    <p className="text-[10px] text-muted-foreground">Disponible</p>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-xs font-bold text-foreground">{fmt(ad.minSingleTransAmount)}–{fmt(ad.maxSingleTransAmount)}</p>
                    <p className="text-[10px] text-muted-foreground">Límites</p>
                  </div>
                </div>

                {/* Bot info + toggle */}
                <div className="px-4 py-2.5 border-t border-white/8 bg-black/25 flex items-center justify-between">
                  {bot ? (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                      bot.status === 'RUNNING'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-white/7 text-muted-foreground border border-white/10'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${bot.status === 'RUNNING' ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`} />
                      Bot: {bot.status}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Sin bot</span>
                  )}

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openEdit(ad)}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toggleAd(ad.advNo)}
                      disabled={toggling === ad.advNo}
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded border transition-colors ${
                        isOnline
                          ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                      }`}
                    >
                      {toggling === ad.advNo ? '...' : isOnline ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>

                {/* Pay methods */}
                {ad.payMethods && ad.payMethods.length > 0 && (
                  <div className="px-4 py-2 border-t border-white/5 flex flex-wrap gap-1">
                    {ad.payMethods.slice(0, 4).map(m => (
                      <span key={m} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">{m}</span>
                    ))}
                    {ad.payMethods.length > 4 && (
                      <span className="text-[9px] text-muted-foreground">+{ad.payMethods.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Ad Modal */}
      {editAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onMouseDown={e => { if (e.target === e.currentTarget) setEditAd(null); }}>
          <div className="bg-[#111827] border border-primary/20 rounded-2xl p-5 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="font-bold text-base mb-1">Editar Anuncio</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {editAd.asset}/{editAd.fiatUnit} {editAd.tradeType} · <span className="font-mono">{editAd.advNo}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Precio ({editAd.fiatUnit})</label>
                <input type="number" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder={editAd.price} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Cantidad disponible ({editAd.asset})</label>
                <input type="number" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} placeholder={editAd.surplusAmount} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Mínimo ({editAd.fiatUnit})</label>
                  <input type="number" step="0.01" value={editMin} onChange={e => setEditMin(e.target.value)} placeholder={editAd.minSingleTransAmount} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Máximo ({editAd.fiatUnit})</label>
                  <input type="number" step="0.01" value={editMax} onChange={e => setEditMax(e.target.value)} placeholder={editAd.maxSingleTransAmount} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Observaciones</label>
                <textarea value={editRemarks} onChange={e => setEditRemarks(e.target.value)} placeholder="Notas del anuncio..." className={inputClass + ' h-16 resize-none'} />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditAd(null)} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button onClick={saveEdit} disabled={saving} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
