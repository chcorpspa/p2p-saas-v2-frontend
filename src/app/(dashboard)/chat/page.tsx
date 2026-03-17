'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSocket } from '@/lib/socket';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ChatPage() {
  const qc = useQueryClient();
  const socket = useSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  // Fetch all accounts for the tenant
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then(r => r.data),
    refetchInterval: 60_000,
  });

  // Set default account when accounts load
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Fetch active orders for the selected account
  const { data: orders = [] } = useQuery({
    queryKey: ['active-orders', selectedAccountId],
    queryFn: () =>
      selectedAccountId
        ? api.get(`/orders/active?accountId=${selectedAccountId}`).then(r => r.data)
        : Promise.resolve([]),
    enabled: !!selectedAccountId,
    refetchInterval: 15_000,
  });

  // Fetch chat history for selected order (filter internal sentinels)
  const { data: messages = [] } = useQuery({
    queryKey: ['chat', selectedOrder],
    queryFn: () =>
      selectedOrder
        ? api.get(`/chat/${selectedOrder}/history`).then(r =>
            (r.data as any[]).filter(m => !m.content?.startsWith('__'))
          )
        : Promise.resolve([]),
    enabled: !!selectedOrder,
    refetchInterval: 10_000,
  });

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Invalidate chat cache on incoming WebSocket message
  useEffect(() => {
    if (!socket) return;
    const onMessage = () =>
      qc.invalidateQueries({ queryKey: ['chat', selectedOrder] });
    socket.on('chat:message', onMessage);
    return () => {
      socket.off('chat:message', onMessage);
    };
  }, [socket, qc, selectedOrder]);

  const sendMessage = async () => {
    if (!selectedOrder || !selectedAccountId || !message.trim()) return;
    const text = message;
    setMessage('');
    try {
      await api.post(`/chat/${selectedOrder}/send`, {
        accountId: selectedAccountId,
        content: text,
      });
      qc.invalidateQueries({ queryKey: ['chat', selectedOrder] });
    } catch {
      setMessage(text); // restore on error
    }
  };

  const renderMessageContent = (msg: any) => {
    const isImage =
      msg.msgType === 'image' ||
      (typeof msg.content === 'string' && msg.content.startsWith('http'));

    if (isImage) {
      const proxied = `${process.env.NEXT_PUBLIC_API_URL}/image-proxy?url=${encodeURIComponent(msg.content)}`;
      return (
        <img
          src={proxied}
          alt="chat image"
          className="max-w-full rounded"
          style={{ maxHeight: 200 }}
        />
      );
    }
    return <span>{msg.content}</span>;
  };

  return (
    <div className="p-6 h-full">
      <div className="flex h-full gap-4">
        {/* Left panel — account selector + order list */}
        <div className="w-72 border border-zinc-700 rounded-lg flex flex-col bg-zinc-900">
          {/* Account selector */}
          {accounts.length > 1 && (
            <div className="p-3 border-b border-zinc-700">
              <label className="text-xs text-zinc-400 mb-1 block">Cuenta</label>
              <select
                value={selectedAccountId ?? ''}
                onChange={e => {
                  setSelectedAccountId(e.target.value);
                  setSelectedOrder(null);
                }}
                className="w-full bg-zinc-800 border border-zinc-600 text-zinc-100 text-sm rounded px-2 py-1 focus:outline-none"
              >
                {accounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.label ?? acc.name ?? acc.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="p-3 border-b border-zinc-700 font-medium text-sm text-zinc-200">
            Ordenes activas
          </div>

          <div className="flex-1 overflow-auto">
            {orders.map((order: any) => (
              <button
                key={order.orderNo}
                onClick={() => setSelectedOrder(order.orderNo)}
                className={`w-full text-left px-3 py-3 text-sm border-b border-zinc-800 transition-colors ${
                  selectedOrder === order.orderNo
                    ? 'bg-yellow-500/10 border-l-2 border-l-yellow-400'
                    : 'hover:bg-zinc-800/60'
                }`}
              >
                <div className="font-medium truncate text-zinc-100">{order.orderNo}</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {order.counterparty ?? order.advertiserNickname ?? '—'}
                </div>
                {order.amount && (
                  <div className="text-xs text-zinc-500 mt-0.5">{order.amount} USDT</div>
                )}
              </button>
            ))}
            {orders.length === 0 && (
              <p className="text-sm text-zinc-500 p-4 text-center">
                {selectedAccountId ? 'Sin ordenes activas' : 'Selecciona una cuenta'}
              </p>
            )}
          </div>
        </div>

        {/* Right panel — message thread */}
        <div className="flex-1 border border-zinc-700 rounded-lg flex flex-col bg-zinc-900">
          {selectedOrder ? (
            <>
              <div className="p-3 border-b border-zinc-700 font-medium text-sm text-zinc-200">
                Orden: {selectedOrder}
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-2">
                {(messages as any[]).map((msg: any, i: number) => (
                  <div
                    key={msg.id ?? msg.messageId ?? i}
                    className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                        msg.direction === 'OUTBOUND'
                          ? 'bg-yellow-500 text-zinc-900'
                          : 'bg-zinc-700 text-zinc-100'
                      }`}
                    >
                      {renderMessageContent(msg)}
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-sm text-zinc-500 text-center pt-8">Sin mensajes aun</p>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-zinc-700 flex gap-2">
                <Input
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 bg-zinc-800 border-zinc-600 text-zinc-100 placeholder:text-zinc-500"
                />
                <Button
                  onClick={sendMessage}
                  size="sm"
                  className="bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-medium"
                >
                  Enviar
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
              Selecciona una orden para ver el chat
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
