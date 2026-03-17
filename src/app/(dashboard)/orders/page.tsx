'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/socket';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Account { id: string; label: string; }
interface ActiveOrder {
  orderNo: string;
  counterPartNickName: string;
  quantity: string;
  totalPrice: string;
  unitPrice: string;
  paymentMethod: string;
  status: string;
  createTime: number;
}
interface HistoryOrder {
  orderNo: string;
  tradeType: 'BUY' | 'SELL';
  asset: string;
  fiat: string;
  totalPrice: string;
  amount: string;
  unitPrice: string;
  orderStatus: number;
  counterPartNickName: string;
  createTime: number;
  updatedTime: number;
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
type CancelReason = 'buyer_requests' | 'payment_not_confirmed' | 'duplicate_order';

const STATUS_LABELS: Record<number, string> = {
  1: 'Pendiente', 2: 'Pagado', 3: 'Completado', 4: 'Cancelado', 5: 'Reclamado',
};
const STATUS_COLORS: Record<number, string> = {
  1: 'text-yellow-500', 2: 'text-blue-500', 3: 'text-green-500', 4: 'text-red-500', 5: 'text-orange-500',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  if (status === 'PENDING') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  if (status === 'BUYER_PAID') return 'bg-green-500/20 text-green-400 border-green-500/30';
  return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
}

function elapsed(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function fmt(n: string | number, decimals = 2) {
  return Number(n).toLocaleString('es-VE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OrdersPage() {
  const qc = useQueryClient();
  const socket = useSocket();

  const [accountId, setAccountId] = useState<string>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('selectedAccountId') || '' : ''
  );
  const [selectedOrder, setSelectedOrder] = useState<ActiveOrder | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<CancelReason>('buyer_requests');
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch accounts
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then(r => r.data),
  });

  // Auto-select first account
  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      const id = accounts[0].id;
      setAccountId(id);
      localStorage.setItem('selectedAccountId', id);
    }
  }, [accounts, accountId]);

  // Fetch active orders (poll every 5s)
  const { data: activeOrders = [] } = useQuery<ActiveOrder[]>({
    queryKey: ['orders', 'active', accountId],
    queryFn: () => api.get('/orders/active', { params: { accountId } }).then(r => r.data),
    enabled: !!accountId && tab === 'active',
    refetchInterval: 5000,
  });

  // Fetch history
  const { data: historyData } = useQuery<{ orders: HistoryOrder[]; total: number }>({
    queryKey: ['orders', 'history'],
    queryFn: () => api.get('/orders', { params: { limit: 50 } }).then(r => r.data),
    enabled: tab === 'history',
  });

  const filteredHistory = (historyData?.orders ?? []).filter(o => {
    const matchType = historyTypeFilter === 'ALL' || o.tradeType === historyTypeFilter;
    const q = historySearch.toLowerCase();
    const matchSearch = !q || o.orderNo.toLowerCase().includes(q) || o.counterPartNickName.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  // Load chat history when order selected
  useEffect(() => {
    if (!selectedOrder) { setMessages([]); return; }
    api.get(`/chat/${selectedOrder.orderNo}/history`)
      .then(r => setMessages(r.data))
      .catch(() => setMessages([]));
  }, [selectedOrder?.orderNo]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebSocket — listen for new chat messages
  useEffect(() => {
    if (!socket) return;
    const onMessage = (msg: ChatMessage) => {
      if (msg.orderNo === selectedOrder?.orderNo) {
        setMessages(prev => [...prev, msg]);
      }
    };
    socket.on('chat:message', onMessage);
    return () => { socket.off('chat:message', onMessage); };
  }, [socket, selectedOrder?.orderNo]);

  // Join WebSocket room when order changes
  useEffect(() => {
    if (!socket || !selectedOrder) return;
    socket.emit('join:order', selectedOrder.orderNo);
  }, [socket, selectedOrder?.orderNo]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const markPaid = useMutation({
    mutationFn: () =>
      api.post(`/orders/${selectedOrder!.orderNo}/mark-paid`, { accountId }).then(r => r.data),
    onSuccess: () => {
      toast.success('Orden marcada como pagada');
      qc.invalidateQueries({ queryKey: ['orders', 'active', accountId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const release = useMutation({
    mutationFn: () =>
      api.post(`/orders/${selectedOrder!.orderNo}/release`, { accountId }).then(r => r.data),
    onSuccess: () => {
      toast.success('Cripto liberado');
      qc.invalidateQueries({ queryKey: ['orders', 'active', accountId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelOrder = useMutation({
    mutationFn: () =>
      api.post(`/orders/${selectedOrder!.orderNo}/cancel`, { accountId, reason: cancelReason }).then(r => r.data),
    onSuccess: () => {
      toast.success('Orden cancelada');
      setShowCancel(false);
      qc.invalidateQueries({ queryKey: ['orders', 'active', accountId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requestKyc = useMutation({
    mutationFn: () =>
      api.post(`/orders/${selectedOrder!.orderNo}/kyc`, { accountId }).then(r => r.data),
    onSuccess: () => toast.success('KYC solicitado'),
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMessage = async () => {
    if (!msgInput.trim() || !selectedOrder) return;
    const msg = msgInput.trim();
    setMsgInput('');
    try {
      await api.post(`/chat/${selectedOrder.orderNo}/send`, { content: msg });
    } catch {
      toast.error('Error al enviar mensaje');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* ── Tab switcher ──────────────────────────────────────────── */}
      <div className="flex gap-2 p-4 border-b border-border shrink-0">
        <button
          onClick={() => setTab('active')}
          className={`px-4 py-1.5 text-sm rounded ${tab === 'active' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Activas
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-1.5 text-sm rounded ${tab === 'history' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Historial
        </button>
      </div>

      {tab === 'active' ? (
        /* ── Active Orders: 3-column layout ───────────────────────── */
        <div className="flex flex-1 min-h-0">

          {/* Left: Order List */}
          <div className="w-1/3 border-r border-border flex flex-col">
            <div className="p-4 border-b border-border">
              <select
                value={accountId}
                onChange={e => { setAccountId(e.target.value); localStorage.setItem('selectedAccountId', e.target.value); setSelectedOrder(null); }}
                className="w-full text-sm bg-secondary border border-border rounded px-2 py-1.5 text-foreground"
              >
                {accounts.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-y-auto">
              {activeOrders.length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-sm">Sin órdenes activas</div>
              )}
              {activeOrders.map((o: ActiveOrder) => (
                <button
                  key={o.orderNo}
                  onClick={() => setSelectedOrder(o)}
                  className={`w-full text-left px-4 py-3 border-b border-border hover:bg-accent/30 transition-colors ${
                    selectedOrder?.orderNo === o.orderNo ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{o.counterPartNickName}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColor(o.status)}`}>{o.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{fmt(o.quantity)} USDT</span>
                    {o.createTime && <span>{elapsed(o.createTime)}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Middle: Chat */}
          <div className="w-1/3 border-r border-border flex flex-col">
            {!selectedOrder ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Selecciona una orden
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-border text-sm font-medium text-foreground">
                  Chat — #{selectedOrder.orderNo.slice(-8)}
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {messages.map(m => (
                    <div key={m.id} className={`flex ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                      {m.msgType === 3 && m.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/api/image-proxy?url=${encodeURIComponent(m.imageUrl)}`}
                          alt="img"
                          className="max-w-[180px] rounded"
                        />
                      ) : (
                        <div className={`max-w-[70%] px-3 py-1.5 rounded-lg text-sm ${
                          m.direction === 'OUTBOUND'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-foreground'
                        }`}>
                          {m.content}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t border-border flex gap-2">
                  <input
                    className="flex-1 bg-secondary border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                    placeholder="Escribe un mensaje..."
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  />
                  <Button size="sm" onClick={sendMessage} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Enviar
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Right: Order Detail + Actions */}
          <div className="w-1/3 flex flex-col">
            {!selectedOrder ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Selecciona una orden para ver detalles
              </div>
            ) : (
              <div className="p-5 space-y-4 overflow-y-auto">
                <div>
                  <p className="text-xs text-muted-foreground">Orden</p>
                  <p className="text-sm font-mono">{selectedOrder.orderNo}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contraparte</p>
                  <p className="font-medium">{selectedOrder.counterPartNickName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Método de pago</p>
                  <p className="text-sm">{selectedOrder.paymentMethod}</p>
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground mb-1">USDT</p>
                  <p className="text-2xl font-bold text-primary">{fmt(selectedOrder.quantity)} USDT</p>
                </div>
                <div className="flex justify-between text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Total VES</p>
                    <p className="font-medium">{fmt(selectedOrder.totalPrice, 2)} Bs</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Precio unitario</p>
                    <p className="font-medium">{fmt(selectedOrder.unitPrice, 2)}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-border pt-3 space-y-2">
                  <Button
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-500 text-white"
                    onClick={() => markPaid.mutate()}
                    disabled={markPaid.isPending}
                  >
                    {markPaid.isPending ? 'Procesando...' : 'Marcar Pagado'}
                  </Button>
                  <Button
                    size="sm"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => release.mutate()}
                    disabled={release.isPending || selectedOrder.status !== 'BUYER_PAID'}
                  >
                    {release.isPending ? 'Procesando...' : 'Liberar Cripto'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowCancel(true)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={() => requestKyc.mutate()}
                    disabled={requestKyc.isPending}
                  >
                    {requestKyc.isPending ? 'Enviando...' : 'Solicitar KYC'}
                  </Button>
                </div>

                {/* Cancel dialog */}
                {showCancel && (
                  <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
                    <p className="text-sm font-medium">Motivo de cancelación</p>
                    {(['buyer_requests', 'payment_not_confirmed', 'duplicate_order'] as CancelReason[]).map(r => (
                      <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="reason"
                          value={r}
                          checked={cancelReason === r}
                          onChange={() => setCancelReason(r)}
                        />
                        <span>
                          {r === 'buyer_requests' ? 'Comprador solicita' :
                           r === 'payment_not_confirmed' ? 'Pago no confirmado' :
                           'Orden duplicada'}
                        </span>
                      </label>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => cancelOrder.mutate()}
                        disabled={cancelOrder.isPending}
                      >
                        {cancelOrder.isPending ? 'Cancelando...' : 'Confirmar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1"
                        onClick={() => setShowCancel(false)}
                      >
                        Volver
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── History Tab: full-width table ────────────────────────── */
        <div className="flex flex-col flex-1 min-h-0 p-4 space-y-4">
          {/* Filters */}
          <div className="flex gap-3 items-center">
            <input
              className="flex-1 max-w-xs bg-secondary border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
              placeholder="Buscar orden # o contraparte..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
            />
            <div className="flex gap-1">
              {(['ALL', 'BUY', 'SELL'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setHistoryTypeFilter(t)}
                  className={`px-3 py-1.5 text-sm rounded border ${
                    historyTypeFilter === t
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'ALL' ? 'Todas' : t}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredHistory.length} órdenes
            </span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Orden #</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Contraparte</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Monto</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Precio</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Sin historial
                    </td>
                  </tr>
                )}
                {filteredHistory.map(o => (
                  <tr key={o.orderNo} className="border-t border-border hover:bg-accent/20 transition-colors">
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {new Date(o.createTime).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="p-3 font-mono text-xs">{o.orderNo.slice(-12)}</td>
                    <td className="p-3">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        o.tradeType === 'BUY' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {o.tradeType}
                      </span>
                    </td>
                    <td className="p-3">{o.counterPartNickName}</td>
                    <td className="p-3 text-right font-medium">
                      {fmt(o.amount)} {o.asset}
                    </td>
                    <td className="p-3 text-right text-muted-foreground">
                      {fmt(o.unitPrice, 2)} {o.fiat}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-medium ${STATUS_COLORS[o.orderStatus] ?? 'text-muted-foreground'}`}>
                        {STATUS_LABELS[o.orderStatus] ?? o.orderStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
