'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/socket';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Search, MessageSquare, Filter, RefreshCw, Copy, Check, Download } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Account { id: string; label: string; }

interface ActiveOrder {
  orderNo: string;
  orderStatus: number;
  tradeType: string;
  asset: string;
  fiat: string;
  amount: string;
  totalPrice: string;
  unitPrice: string;
  counterPartNickName: string;
  buyerName?: string;
  sellerName?: string;
  paymentMethod?: string;
  createTime: number;
  advNo?: string;
}

interface ChatMessage {
  id: string;
  orderNo: string;
  direction: 'INBOUND' | 'OUTBOUND';
  msgType: number;
  content: string;
  imageUrl?: string;
  createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  1: { label: 'Pendiente', color: '#0ea5e9' },
  2: { label: 'En proceso', color: '#0ea5e9' },
  3: { label: 'Pagada', color: '#f0b90b' },
  4: { label: 'Completada', color: '#10b981' },
  5: { label: 'Cancelada', color: '#ef4444' },
  6: { label: 'Reclamada', color: '#64748b' },
};

const SYS_MSG_MAP: Record<string, string> = {
  'order_created_with_additional_kyc_maker_buy': 'Orden creada — verificación KYC',
  'order_created_with_additional_kyc_disclaimer': 'Aviso de verificación KYC adicional',
  'maker_verified_additional_kyc_maker_buy': 'KYC verificado por el comprador',
  'maker_verified_additional_kyc_maker_sell': 'KYC verificado por el vendedor',
  'buyer_transfer_payment': 'El comprador marcó el pago como realizado',
  'buyer_payed': 'Comprador marcó pagado',
  'seller_release_crypto': 'Vendedor liberó la crypto',
  'seller_released': 'Vendedor liberó la crypto',
  'order_completed': 'Operación completada',
  'order_cancelled': 'Orden cancelada',
  'buyer_completed': 'Comprador confirmó la operación',
  'risk_alert': 'Alerta de riesgo del sistema',
  'risk_reminder': 'Recordatorio de seguridad',
};

const VE_BANKS: Record<string, string> = {
  '0102': 'BDV', '0104': 'Venezolano de Crédito', '0105': 'Mercantil', '0108': 'Provincial',
  '0114': 'Bancaribe', '0134': 'Banesco', '0151': 'BFC', '0157': 'Del Sur',
  '0171': 'Activo', '0172': 'Bancamiga', '0174': 'Banplus', '0175': 'Bicentenario', '0191': 'BNC',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtFiat(amount: string | number, fiat = 'VES') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '—';
  const fmt = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (['VES','COP','CLP','ARS','PEN','BOB'].includes(fiat.toUpperCase()))
    return fmt.replace(/,/g, 'X').replace(/\./g, ',').replace(/X/g, '.');
  return fmt;
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function CopyBtn({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="opacity-40 hover:opacity-100 shrink-0" title="Copiar">
      {ok ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
    </button>
  );
}

function CopiableRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div onClick={() => { navigator.clipboard.writeText(value); toast.success('Copiado'); }}
      className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer border-b border-white/4 hover:bg-[rgba(14,165,233,0.06)] transition-colors">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-sm font-semibold text-foreground">{value}</span>
      </div>
      <CopyBtn value={value} />
    </div>
  );
}

function parsePaymentFields(detail: any, totalPrice: string, fiat: string) {
  if (!detail) return null;
  const payMethods = detail.payMethods || detail.tradeMethods || [];
  if (!payMethods.length) return null;
  return payMethods.map((pm: any) => {
    const name = pm.tradeMethodName || pm.payMethodName || pm.identifier || 'Método';
    const fields = pm.fieldList || pm.fields || [];
    let phone = '', idNumber = '', bankName = '', realName = '', accountNo = '';
    for (const f of fields) {
      if (!f.fieldValue) continue;
      const val = f.fieldValue.trim();
      const key = (f.fieldName || f.fieldId || '').toLowerCase();
      if (/^01\d{18}$/.test(val)) { accountNo = accountNo || val; if (!bankName) bankName = VE_BANKS[val.substring(0,4)] || 'Banco '+val.substring(0,4); }
      else if (['phone','telefono','mobile','celular'].some(k => key.includes(k)) || /^\d{10,12}$/.test(val.replace(/\D/g,''))) phone = val;
      else if (['id number','cedula','ci','documento','identity'].some(k => key.includes(k))) idNumber = val;
      else if (['account','cuenta'].some(k => key.includes(k))) accountNo = accountNo || val;
      else if (['bank','banco'].some(k => key.includes(k))) bankName = bankName || val;
      else if (['name','nombre','receiver'].some(k => key.includes(k))) realName = val;
      else if (!phone && !accountNo) phone = val;
    }
    if (!accountNo && detail.payAccount) accountNo = detail.payAccount;
    if (!bankName && detail.payBank) bankName = detail.payBank;
    if (!realName && (detail.sellerName || detail.buyerName)) realName = detail.sellerName || detail.buyerName;
    if (!fields.length) { phone = pm.accountNo || ''; bankName = pm.bankName || ''; realName = pm.realName || ''; }
    return { name, phone, idNumber, bankName, realName, accountNo, amount: fmtFiat(totalPrice, fiat) };
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const qc = useQueryClient();
  const socket = useSocket();
  const [accountId, setAccountId] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('selectedAccountId') || '' : '');
  const [selected, setSelected] = useState<ActiveOrder | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Toolbar state
  const [filterTab, setFilterTab] = useState<'active' | 'done' | 'all'>('active');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [advStatus, setAdvStatus] = useState('');
  const [advSide, setAdvSide] = useState('');
  const [advSort, setAdvSort] = useState('newest');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ['accounts'], queryFn: () => api.get('/accounts').then(r => r.data) });
  useEffect(() => { if (!accountId && accounts.length) { setAccountId(accounts[0].id); localStorage.setItem('selectedAccountId', accounts[0].id); } }, [accounts, accountId]);

  const { data: activeOrders = [], refetch: refetchActive } = useQuery<ActiveOrder[]>({
    queryKey: ['orders', 'active', accountId],
    queryFn: () => api.get('/orders/active', { params: { accountId } }).then(r => r.data),
    enabled: !!accountId, refetchInterval: 5000,
  });

  const { data: historyData } = useQuery<{ orders: any[]; total: number }>({
    queryKey: ['orders', 'history'],
    queryFn: () => api.get('/orders', { params: { limit: 200 } }).then(r => r.data),
    enabled: filterTab !== 'active',
  });

  // Merge active + history for "all" tab
  const allOrders = filterTab === 'active' ? activeOrders
    : filterTab === 'done' ? (historyData?.orders ?? []).map((o: any) => ({
        orderNo: o.orderNo, orderStatus: 4, tradeType: o.orderType || 'SELL',
        asset: o.asset, fiat: o.fiat, amount: String(o.quantity),
        totalPrice: String(o.totalPrice), unitPrice: String(o.price),
        counterPartNickName: o.counterparty, createTime: new Date(o.completedAt).getTime(),
        paymentMethod: o.payMethod,
      }))
    : [...activeOrders, ...(historyData?.orders ?? []).map((o: any) => ({
        orderNo: o.orderNo, orderStatus: 4, tradeType: o.orderType || 'SELL',
        asset: o.asset, fiat: o.fiat, amount: String(o.quantity),
        totalPrice: String(o.totalPrice), unitPrice: String(o.price),
        counterPartNickName: o.counterparty, createTime: new Date(o.completedAt).getTime(),
        paymentMethod: o.payMethod,
      }))];

  // Apply filters
  const filtered = allOrders.filter(o => {
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!o.orderNo.toLowerCase().includes(q) && !o.counterPartNickName.toLowerCase().includes(q)) return false;
    }
    if (advStatus && String(o.orderStatus) !== advStatus) return false;
    if (advSide && o.tradeType !== advSide) return false;
    return true;
  }).sort((a, b) => advSort === 'oldest' ? a.createTime - b.createTime : b.createTime - a.createTime);

  // Chat + detail
  useEffect(() => {
    if (!selected) { setMessages([]); setDetail(null); return; }
    api.get(`/chat/${selected.orderNo}/history`).then(r => setMessages((r.data as ChatMessage[]).filter(m => !m.content?.startsWith('__')))).catch(() => setMessages([]));
    setDetailLoading(true);
    api.get(`/orders/${selected.orderNo}/detail`, { params: { accountId } }).then(r => setDetail(r.data)).catch(() => setDetail(null)).finally(() => setDetailLoading(false));
  }, [selected?.orderNo]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (!socket) return;
    const onMsg = (msg: ChatMessage) => { if (msg.orderNo === selected?.orderNo && !msg.content?.startsWith('__')) setMessages(prev => [...prev, msg]); };
    socket.on('chat:message', onMsg); return () => { socket.off('chat:message', onMsg); };
  }, [socket, selected?.orderNo]);
  useEffect(() => { if (socket && selected) socket.emit('join:order', selected.orderNo); }, [socket, selected?.orderNo]);

  // Actions
  const doAction = async (action: string) => {
    if (!selected) return;
    try {
      await api.post(`/orders/${selected.orderNo}/${action}`, { accountId });
      toast.success(action === 'mark-paid' ? 'Marcado pagado' : action === 'release' ? 'Crypto liberado' : action === 'cancel' ? 'Cancelada' : action === 'kyc' ? 'KYC solicitado' : 'OK');
      if (['release','cancel'].includes(action)) { setSelected(null); qc.setQueryData<ActiveOrder[]>(['orders','active',accountId], p => (p||[]).filter(o => o.orderNo !== selected.orderNo)); }
      qc.invalidateQueries({ queryKey: ['orders'] });
    } catch (e: any) { toast.error(e.response?.data?.message || 'Error'); }
  };
  const sendFeedback = async (type: number) => {
    if (!selected) return;
    try { await api.post(`/orders/${selected.orderNo}/feedback`, { accountId, feedbackType: type }); toast.success(type === 1 ? '👍 Positivo' : '👎 Negativo'); } catch { toast.error('Error'); }
  };
  const sendMsg = async () => {
    if (!msgInput.trim() || !selected) return;
    const m = msgInput.trim(); setMsgInput('');
    try { await api.post(`/chat/${selected.orderNo}/send`, { content: m }); } catch { toast.error('Error'); }
  };
  const sendImg = async (file: File) => {
    if (!selected || file.size > 5*1024*1024) { toast.error('Máx 5MB'); return; }
    try { const f = new FormData(); f.append('file', file); f.append('accountId', accountId); await api.post(`/chat/${selected.orderNo}/send-image`, f, { headers: { 'Content-Type': 'multipart/form-data' } }); toast.success('Imagen enviada'); } catch { toast.error('Error'); }
  };
  const exportCSV = () => {
    const token = localStorage.getItem('token');
    fetch('/api/orders/export/csv', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob()).then(blob => { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = 'orders.csv'; a.click(); })
      .catch(() => toast.error('Error'));
  };

  const o = selected;
  const st = o ? o.orderStatus : 0;
  const stInfo = STATUS_MAP[st] || STATUS_MAP[1];
  const sideColor = o?.tradeType === 'BUY' ? '#10b981' : '#ef4444';
  const sideLabel = o?.tradeType === 'BUY' ? 'Compra' : 'Venta';
  const fiat = o?.fiat || 'VES';

  return (
    <div className="flex flex-col h-full">
      {/* ═══ TOOLBAR (like old system) ═══ */}
      <div className="flex items-center gap-2.5 px-4 py-2 border-b border-border flex-wrap" style={{ background: 'rgba(255,255,255,0.01)' }}>
        <select value={accountId} onChange={e => { setAccountId(e.target.value); localStorage.setItem('selectedAccountId', e.target.value); setSelected(null); }}
          className="min-w-[160px] text-sm bg-secondary border border-border rounded px-2.5 py-1.5 text-foreground">
          <option value="">Selecciona cuenta...</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>

        {/* Icon buttons */}
        <button onClick={() => setShowSearch(!showSearch)} title="Buscar" className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-white/5"><Search size={14} /></button>
        <button onClick={() => setShowFilters(!showFilters)} title="Filtros avanzados" className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-white/5"><Filter size={14} /></button>
        <button onClick={() => refetchActive()} title="Recargar" className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-white/5"><RefreshCw size={14} /></button>

        {/* Filter tabs */}
        <div className="flex gap-1 ml-auto">
          {(['active','done','all'] as const).map(t => (
            <button key={t} onClick={() => setFilterTab(t)}
              className={`px-3 py-1 text-[11px] rounded border font-medium transition-colors ${filterTab === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              {t === 'active' ? 'En Proceso' : t === 'done' ? 'Procesadas' : 'Todas'}
            </button>
          ))}
        </div>
      </div>

      {/* Search bar (toggle) */}
      {showSearch && (
        <div className="px-4 py-2 border-b border-border">
          <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Buscar por número de orden, nombre o nickname..."
            className="w-full text-sm bg-secondary border border-border rounded px-3 py-2 text-foreground focus:outline-none focus:border-primary" autoFocus />
        </div>
      )}

      {/* Advanced filters (toggle) */}
      {showFilters && (
        <div className="px-4 py-2.5 border-b border-border flex gap-4 flex-wrap items-end" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Estado</p>
            <select value={advStatus} onChange={e => setAdvStatus(e.target.value)} className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground">
              <option value="">Todos</option><option value="2">En proceso</option><option value="3">Pagada</option><option value="4">Completada</option><option value="5">Cancelada</option>
            </select>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Tipo</p>
            <select value={advSide} onChange={e => setAdvSide(e.target.value)} className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground">
              <option value="">Compra y Venta</option><option value="BUY">Compra</option><option value="SELL">Venta</option>
            </select>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase mb-1">Ordenar</p>
            <select value={advSort} onChange={e => setAdvSort(e.target.value)} className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground">
              <option value="newest">Más recientes</option><option value="oldest">Más antiguas</option>
            </select>
          </div>
          <button onClick={() => { setAdvStatus(''); setAdvSide(''); setAdvSort('newest'); }} className="text-[11px] text-muted-foreground hover:text-foreground">Limpiar</button>
          <button onClick={exportCSV} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"><Download size={11} /> CSV</button>
        </div>
      )}

      {/* ═══ 3-COLUMN LAYOUT ═══ */}
      <div className="flex flex-1 min-h-0" style={{ height: 'calc(100vh - 100px)' }}>

        {/* ── LEFT: Order list (300px) ── */}
        <div className="w-[300px] shrink-0 border-r border-border flex flex-col">
          <div className="flex-1 overflow-y-auto p-2">
            {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-10">Sin órdenes</p>}
            {filtered.map(ord => {
              const sc = ord.tradeType === 'BUY' ? '#10b981' : '#ef4444';
              const sl = ord.tradeType === 'BUY' ? 'Compra' : 'Venta';
              const si = STATUS_MAP[ord.orderStatus] || STATUS_MAP[1];
              const sel = selected?.orderNo === ord.orderNo;
              return (
                <div key={ord.orderNo} onClick={() => setSelected(ord)} className="cursor-pointer rounded-lg px-3 py-2.5 mb-1 transition-all"
                  style={{ borderLeft: `3px solid ${sc}`, background: sel ? 'rgba(240,185,11,0.08)' : 'transparent', border: sel ? `1px solid rgba(240,185,11,0.2)` : undefined, borderLeftWidth: '3px', borderLeftStyle: 'solid', borderLeftColor: sc }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs" style={{ color: sc }}>{ord.asset||'USDT'}</span>
                      <span className="text-[11px]" style={{ color: sc }}>{sl}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: `${si.color}18`, color: si.color, border: `1px solid ${si.color}33` }}>{si.label}</span>
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs">
                    <span className="font-semibold text-foreground">{fmtFiat(ord.totalPrice, ord.fiat||'VES')} {ord.fiat||'VES'}</span>
                    <span className="text-muted-foreground text-[11px]">{timeAgo(ord.createTime)}</span>
                  </div>
                  <div className="flex justify-between mt-1 text-[11px]">
                    <span className="text-muted-foreground">{(ord as any).buyerName || (ord as any).sellerName || ord.counterPartNickName}</span>
                    <span className="text-muted-foreground/60">{ord.paymentMethod || ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border">
            {filtered.length} orden{filtered.length !== 1 ? 'es' : ''}
          </div>
        </div>

        {/* ── CENTER: Chat ── */}
        <div className="flex-1 border-r border-border flex flex-col">
          {!o ? <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Selecciona una orden para ver el chat</div> : (<>
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-muted-foreground">#{o.orderNo}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold ml-2" style={{ background: `${stInfo.color}18`, color: stInfo.color, border: `1px solid ${stInfo.color}33` }}>{stInfo.label}</span>
                </div>
                <span className="font-bold text-sm" style={{ color: sideColor }}>{sideLabel}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-semibold text-foreground">{o.counterPartNickName}</span>
                {(o.buyerName || o.sellerName) && <span className="text-xs text-muted-foreground">{o.buyerName || o.sellerName}</span>}
              </div>
              {/* Feedback */}
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => sendFeedback(1)} className="text-[11px] px-2.5 py-1 rounded font-semibold bg-green-600/20 text-green-400 border border-green-500/30">👍 Positivo</button>
                <button onClick={() => sendFeedback(2)} className="text-[11px] px-2.5 py-1 rounded font-semibold bg-red-500/15 text-red-400 border border-red-500/30">👎 Negativo</button>
              </div>
              {/* Actions */}
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {st <= 2 && <button onClick={() => doAction('kyc')} className="text-[11px] px-2.5 py-1 rounded font-semibold" style={{ background: 'rgba(251,191,36,0.15)', color: '#f0b90b', border: '1px solid rgba(251,191,36,0.3)' }}>🛡 Verificar KYC</button>}
                {(st === 2 || st === 3) && o.tradeType === 'SELL' && <button onClick={() => doAction('release')} className="text-[11px] px-2.5 py-1 rounded font-semibold bg-green-600 text-white">✓ Liberar Crypto</button>}
                {st <= 2 && o.tradeType === 'BUY' && <button onClick={() => doAction('mark-paid')} className="text-[11px] px-2.5 py-1 rounded font-semibold bg-primary text-primary-foreground">Marcar Pagado</button>}
                {[1,2].includes(st) && <button onClick={() => doAction('cancel')} className="text-[11px] px-2.5 py-1 rounded font-semibold" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>Cancelar</button>}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {messages.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Sin mensajes aún</p>}
              {messages.map(m => {
                const isOut = m.direction === 'OUTBOUND';
                const isImg = m.msgType === 3 || m.imageUrl || (typeof m.content === 'string' && m.content.startsWith('http'));
                const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '';

                // System messages
                let sysText = '';
                if (m.content) {
                  try { const p = JSON.parse(m.content); sysText = SYS_MSG_MAP[p.type] || ''; } catch { /* not JSON */ }
                  if (!sysText) {
                    for (const [k, v] of Object.entries(SYS_MSG_MAP)) {
                      if (m.content.includes(k)) { sysText = v; break; }
                    }
                  }
                }
                if (sysText || m.msgType === 99) {
                  return <div key={m.id} className="text-center py-1"><span className="text-[10px] text-muted-foreground bg-white/4 px-2.5 py-0.5 rounded-full">{sysText || m.content}</span> <span className="text-[9px] text-muted-foreground/50">{time}</span></div>;
                }

                return (
                  <div key={m.id} className={`flex mb-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] ${isOut ? 'bg-primary/20 border-primary/30' : 'bg-secondary border-border'} border rounded-lg px-3 py-1.5`}>
                      {isImg ? <img src={`/api/image-proxy?url=${encodeURIComponent(m.imageUrl ?? m.content)}`} alt="" className="max-w-[200px] rounded cursor-pointer" /> : <p className="text-sm text-foreground whitespace-pre-wrap">{m.content}</p>}
                      <p className={`text-[10px] mt-0.5 ${isOut ? 'text-right text-primary/60' : 'text-muted-foreground/60'}`}>{time} {isOut && '✓✓'}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-2 border-t border-border flex gap-2">
              <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && sendImg(e.target.files[0])} />
              <button onClick={() => fileInputRef.current?.click()} className="p-2 text-muted-foreground hover:text-foreground shrink-0" title="Imagen">📎</button>
              <input className="flex-1 bg-secondary border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                placeholder="Escribe un mensaje..." value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} />
              <Button size="sm" onClick={sendMsg} className="bg-primary text-primary-foreground">Enviar</Button>
            </div>
          </>)}
        </div>

        {/* ── RIGHT: Detail (380px) ── */}
        <div className="w-[380px] shrink-0 overflow-y-auto">
          {!o ? <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm h-full">Detalles de la orden</div> : (
            <div>
              {/* Header */}
              <div className="px-4 py-3 bg-white/3 border-b border-border">
                <div className="flex items-center gap-1.5 mb-1.5"><span className="text-[11px] font-mono text-muted-foreground">#{o.orderNo}</span> <CopyBtn value={o.orderNo} /></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${sideColor}18`, color: sideColor, border: `1px solid ${sideColor}33` }}>{sideLabel}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${stInfo.color}18`, color: stInfo.color, border: `1px solid ${stInfo.color}33` }}>{stInfo.label}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{o.paymentMethod || ''}</span>
                </div>
              </div>

              {/* MONTO A PAGAR */}
              <div onClick={() => { navigator.clipboard.writeText(String(o.totalPrice).replace(/[^0-9.]/g,'')); toast.success('Monto copiado'); }}
                className="mx-3 my-3 p-4 rounded-xl cursor-pointer" style={{ background: 'linear-gradient(135deg,rgba(240,185,11,0.1),rgba(240,185,11,0.03))', border: '1px solid rgba(240,185,11,0.25)' }}>
                <div className="flex items-center justify-between">
                  <div><p className="text-[10px] text-primary font-semibold uppercase tracking-wider">Monto a pagar</p><p className="text-[10px] text-muted-foreground mt-0.5">Click para copiar</p></div>
                  <div className="text-right"><p className="text-xl font-extrabold text-primary">{fmtFiat(o.totalPrice, fiat)}</p><p className="text-[10px] text-muted-foreground">{fiat}</p></div>
                </div>
              </div>

              {/* Payment data */}
              {detailLoading ? <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" /></div> : detail ? (
                <div className="px-3 space-y-2.5 mb-3">
                  {parsePaymentFields(detail, o.totalPrice, fiat)?.map((pm: any, i: number) => (
                    <div key={i} className="rounded-xl overflow-hidden" style={{ background: 'rgba(14,165,233,0.04)', border: '1px solid rgba(14,165,233,0.15)' }}>
                      <div className="px-3.5 py-1.5" style={{ background: 'rgba(14,165,233,0.06)', borderBottom: '1px solid rgba(14,165,233,0.1)' }}>
                        <span className="text-xs font-bold" style={{ color: '#0ea5e9' }}>{pm.name}</span>
                      </div>
                      {pm.accountNo && <CopiableRow label="Cuenta" value={pm.accountNo} />}
                      {pm.phone && <CopiableRow label="Teléfono" value={pm.phone} />}
                      {pm.idNumber && <CopiableRow label="Cédula" value={pm.idNumber} />}
                      {pm.bankName && <CopiableRow label="Banco" value={pm.bankName} />}
                      <CopiableRow label="Monto" value={pm.amount} />
                      {pm.realName && <div onClick={() => { navigator.clipboard.writeText(pm.realName); toast.success('Copiado'); }} className="px-3.5 py-1.5 text-xs text-muted-foreground cursor-pointer flex items-center gap-1 hover:text-foreground">{pm.realName} <CopyBtn value={pm.realName} /></div>}
                    </div>
                  ))}

                  {/* Counterpart */}
                  <div className="mt-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">👤 Datos de Contraparte</p>
                    <div className="bg-white/3 border border-border rounded-lg p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{o.counterPartNickName}</span>
                        {detail.advertiserUserType === 'merchant' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-bold">Merchant</span>}
                        {detail.onlineStatus === 'online' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-bold">En línea</span>}
                      </div>
                      {(detail.buyerRealName || detail.sellerRealName) && <p className="text-xs text-muted-foreground mt-1">{detail.buyerRealName || detail.sellerRealName}</p>}
                    </div>
                    <div className="mt-2 space-y-0 text-xs">
                      {detail.orderCount != null && <div className="flex justify-between py-1.5 border-b border-border/50"><span className="text-muted-foreground">Órdenes completadas</span><span className="font-bold">{detail.orderCount}</span></div>}
                      {detail.monthOrderCount != null && <div className="flex justify-between py-1.5 border-b border-border/50"><span className="text-muted-foreground">Órdenes (30d)</span><span className="font-bold">{detail.monthOrderCount}</span></div>}
                      {detail.monthFinishRate != null && <div className="flex justify-between py-1.5 border-b border-border/50"><span className="text-muted-foreground">Tasa finalización</span><span className="font-bold text-green-400">{(parseFloat(detail.monthFinishRate)*100).toFixed(2)}%</span></div>}
                      {detail.registerDays != null && <div className="flex justify-between py-1.5 border-b border-border/50"><span className="text-muted-foreground">Días registrado</span><span className="font-bold">{detail.registerDays}</span></div>}
                      {detail.avgPayTime != null && <div className="flex justify-between py-1.5 border-b border-border/50"><span className="text-muted-foreground">Tiempo prom. pago</span><span className="font-bold">{detail.avgPayTime}</span></div>}
                      {detail.avgReleaseTime != null && <div className="flex justify-between py-1.5"><span className="text-muted-foreground">Tiempo prom. liberación</span><span className="font-bold">{detail.avgReleaseTime}</span></div>}
                    </div>
                  </div>

                  <details className="mt-3">
                    <summary className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold cursor-pointer py-1">▸ Detalles de la orden</summary>
                    <div className="bg-white/2 border border-border rounded-lg p-2.5 mt-1 space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Activo</span><span>{o.asset}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Precio</span><span>{fmtFiat(o.unitPrice, fiat)} {fiat}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Cantidad</span><span>{o.amount} {o.asset}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Método</span><span>{o.paymentMethod || '—'}</span></div>
                    </div>
                  </details>
                </div>
              ) : <p className="px-4 text-xs text-muted-foreground py-4">Sin datos de detalle</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
