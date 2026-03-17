'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RefreshCw, LogOut, CheckCircle, XCircle, Clock, AlertCircle, Phone } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://p2p.chcorporacion.com/api';

interface Order {
  orderNo: string;
  orderStatus: number; // 1=pending, 2=paid, 4=completed, 5=cancelled
  tradeType: string;
  amount: string;
  totalPrice: string;
  unitPrice: string;
  asset: string;
  fiat: string;
  counterPartNickName: string;
  payMethodName: string;
  accountId: string;
  accountLabel: string;
  advNo: string;
  buyerRealName?: string;
  bankInfo?: any;
}

const STATUS_MAP: Record<number, { label: string; color: string; icon: React.ReactNode }> = {
  1: { label: 'Pendiente', color: 'text-amber-400', icon: <Clock className="w-3.5 h-3.5" /> },
  2: { label: 'Pagado', color: 'text-blue-400', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  4: { label: 'Completado', color: 'text-emerald-400', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  5: { label: 'Cancelado', color: 'text-red-400', icon: <XCircle className="w-3.5 h-3.5" /> },
};

export default function OperatorOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [opName, setOpName] = useState('');
  const [opAdvNos, setOpAdvNos] = useState<string[]>([]);

  const getToken = () => localStorage.getItem('op_token');

  // Auth check
  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/op/login'); return; }
    setOpName(localStorage.getItem('op_name') ?? 'Operador');
    setOpAdvNos(JSON.parse(localStorage.getItem('op_advnos') ?? '[]'));
  }, [router]);

  const fetchOrders = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/orders/all-active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { localStorage.clear(); router.replace('/op/login'); return; }
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Error al cargar órdenes');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000); // Auto-refresh every 15s
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const doAction = async (action: string, order: Order) => {
    const key = `${action}_${order.orderNo}`;
    setActionLoading(key);
    try {
      const res = await fetch(`${API}/orders/${order.orderNo}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId: order.accountId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error');
      }
      toast.success(action === 'mark-paid' ? '✓ Marcado como pagado' : action === 'release' ? '✓ Moneda liberada' : '✓ Acción completada');
      setTimeout(fetchOrders, 1000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const logout = () => {
    localStorage.removeItem('op_token');
    localStorage.removeItem('op_name');
    localStorage.removeItem('op_advnos');
    router.replace('/op/login');
  };

  const bgStyle = {
    background: '#08060f',
    backgroundImage: `
      radial-gradient(ellipse 70% 50% at -5% -5%, oklch(0.58 0.28 280 / 14%) 0%, transparent 60%),
      radial-gradient(ellipse 55% 40% at 105% 100%, oklch(0.50 0.15 220 / 8%) 0%, transparent 55%)
    `,
    backgroundAttachment: 'fixed' as const,
    fontFamily: "'Outfit', 'Segoe UI', sans-serif",
    minHeight: '100vh',
  };

  const cardStyle = {
    background: 'oklch(0.10 0.018 280 / 90%)',
    border: '1px solid oklch(0.58 0.28 280 / 15%)',
    backdropFilter: 'blur(20px)',
  };

  return (
    <div style={bgStyle}>
      {/* Header */}
      <header style={{
        background: 'oklch(0.08 0.018 280 / 90%)',
        borderBottom: '1px solid oklch(0.58 0.28 280 / 15%)',
        backdropFilter: 'blur(20px)',
      }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, oklch(0.58 0.28 280), oklch(0.45 0.22 300))' }}>
              <span className="text-white text-base font-bold">P</span>
            </div>
            <div>
              <span className="text-white font-semibold text-sm">CH P2P</span>
              <span className="text-xs ml-2" style={{ color: 'oklch(0.55 0.05 280)' }}>· {opName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="p-2 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: 'oklch(0.55 0.05 280)' }}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5"
              style={{ color: 'oklch(0.55 0.05 280)' }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Stats bar */}
        <div className="flex items-center gap-4 text-xs" style={{ color: 'oklch(0.55 0.05 280)' }}>
          <span className="text-white font-medium">Mis órdenes activas</span>
          <span>·</span>
          <span>{orders.length} orden{orders.length !== 1 ? 'es' : ''}</span>
          <span>·</span>
          <span>advNos: {opAdvNos.length > 0 ? opAdvNos.join(', ') : 'todos'}</span>
        </div>

        {loading && orders.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: 'oklch(0.58 0.28 280)', borderTopColor: 'transparent' }} />
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl p-16 text-center" style={cardStyle}>
            <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'oklch(0.55 0.05 280)' }} />
            <p className="text-white/60 text-sm">Sin órdenes activas</p>
            <p className="text-white/30 text-xs mt-1">Las nuevas órdenes aparecerán aquí automáticamente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => {
              const status = STATUS_MAP[order.orderStatus] ?? STATUS_MAP[1];
              return (
                <div key={order.orderNo} className="rounded-2xl p-5" style={cardStyle}>
                  {/* Order header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`flex items-center gap-1.5 text-xs ${status.color}`}>
                          {status.icon}
                          {status.label}
                        </span>
                        <span className="text-white/20 text-xs">·</span>
                        <span className="text-white/40 text-xs font-mono">{order.orderNo}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white">
                          {parseFloat(order.totalPrice).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-sm" style={{ color: 'oklch(0.55 0.05 280)' }}>{order.fiat}</span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'oklch(0.55 0.05 280)' }}>
                        {order.amount} {order.asset} · {parseFloat(order.unitPrice).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {order.fiat}/{order.asset}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium text-sm">{order.counterPartNickName}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'oklch(0.55 0.05 280)' }}>{order.payMethodName || '—'}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'oklch(0.40 0.05 280)' }}>{order.accountLabel}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  {order.orderStatus === 1 && (
                    <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'oklch(0.58 0.28 280 / 10%)' }}>
                      <button
                        onClick={() => doAction('mark-paid', order)}
                        disabled={actionLoading === `mark-paid_${order.orderNo}`}
                        className="flex-1 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
                        style={{ background: 'oklch(0.58 0.28 280 / 30%)', border: '1px solid oklch(0.58 0.28 280 / 40%)' }}
                      >
                        {actionLoading === `mark-paid_${order.orderNo}` ? '...' : '✓ Pagado'}
                      </button>
                      <button
                        onClick={() => doAction('release', order)}
                        disabled={actionLoading === `release_${order.orderNo}`}
                        className="flex-1 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
                        style={{ background: 'oklch(0.65 0.20 145 / 25%)', border: '1px solid oklch(0.65 0.20 145 / 40%)' }}
                      >
                        {actionLoading === `release_${order.orderNo}` ? '...' : '⬆ Liberar'}
                      </button>
                    </div>
                  )}

                  {order.orderStatus === 2 && (
                    <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'oklch(0.58 0.28 280 / 10%)' }}>
                      <button
                        onClick={() => doAction('release', order)}
                        disabled={actionLoading === `release_${order.orderNo}`}
                        className="flex-1 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
                        style={{ background: 'oklch(0.65 0.20 145 / 25%)', border: '1px solid oklch(0.65 0.20 145 / 40%)' }}
                      >
                        {actionLoading === `release_${order.orderNo}` ? '...' : '⬆ Liberar moneda'}
                      </button>
                      <button
                        onClick={() => doAction('cancel', order)}
                        disabled={actionLoading === `cancel_${order.orderNo}`}
                        className="py-2 px-4 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                        style={{ color: 'oklch(0.65 0.20 15)', background: 'oklch(0.65 0.20 15 / 15%)', border: '1px solid oklch(0.65 0.20 15 / 30%)' }}
                      >
                        {actionLoading === `cancel_${order.orderNo}` ? '...' : 'Cancelar'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
