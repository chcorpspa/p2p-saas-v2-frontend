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
  const [message, setMessage] = useState('');

  const { data: orders = [] } = useQuery({
    queryKey: ['active-orders'],
    queryFn: () => api.get('/orders/active').then(r => r.data),
    refetchInterval: 15_000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['chat', selectedOrder],
    queryFn: () => selectedOrder
      ? api.get(`/chat/${selectedOrder}/messages`).then(r => r.data)
      : Promise.resolve([]),
    enabled: !!selectedOrder,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = () => qc.invalidateQueries({ queryKey: ['chat', selectedOrder] });
    socket.on('chat:message', onMessage);
    return () => {
      socket.off('chat:message', onMessage);
    };
  }, [socket, qc, selectedOrder]);

  const sendMessage = async () => {
    if (!selectedOrder || !message.trim()) return;
    const text = message;
    setMessage('');
    try {
      await api.post(`/chat/${selectedOrder}/send`, { message: text });
      qc.invalidateQueries({ queryKey: ['chat', selectedOrder] });
    } catch {
      setMessage(text); // restore on error
    }
  };

  return (
    <div className="flex h-full gap-4">
      {/* Left panel — order list */}
      <div className="w-64 border rounded flex flex-col">
        <div className="p-3 border-b font-medium text-sm">Órdenes activas</div>
        <div className="flex-1 overflow-auto">
          {orders.map((order: any) => (
            <button
              key={order.orderNo}
              onClick={() => setSelectedOrder(order.orderNo)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b ${selectedOrder === order.orderNo ? 'bg-muted' : ''}`}
            >
              <div className="font-medium truncate">{order.orderNo}</div>
              <div className="text-xs text-muted-foreground">{order.counterparty}</div>
            </button>
          ))}
          {orders.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center">Sin órdenes activas</p>
          )}
        </div>
      </div>

      {/* Right panel — message thread */}
      <div className="flex-1 border rounded flex flex-col">
        {selectedOrder ? (
          <>
            <div className="p-3 border-b font-medium text-sm">{selectedOrder}</div>
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {(messages as any[]).map((msg: any, i: number) => (
                <div key={msg.id ?? msg.messageId ?? i} className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${msg.direction === 'OUTBOUND' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {msg.message}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-3 border-t flex gap-2">
              <Input
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Escribe un mensaje..."
                className="flex-1"
              />
              <Button onClick={sendMessage} size="sm">Enviar</Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Selecciona una orden para ver el chat
          </div>
        )}
      </div>
    </div>
  );
}
