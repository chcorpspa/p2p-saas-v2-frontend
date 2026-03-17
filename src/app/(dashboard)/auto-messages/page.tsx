'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { toast } from 'sonner';

type Trigger = 'ORDER_CREATED' | 'BUYER_PAID' | 'ORDER_COMPLETED' | 'ORDER_CANCELLED';

interface Account { id: string; label: string; }
interface AutoMessage {
  id: string;
  accountId: string;
  advNo: string | null;
  trigger: Trigger;
  content: string;
  delayMs: number;
  isActive: boolean;
  account: { id: string; label: string };
}

const TRIGGERS: Trigger[] = ['ORDER_CREATED', 'BUYER_PAID', 'ORDER_COMPLETED', 'ORDER_CANCELLED'];
const TRIGGER_LABELS: Record<Trigger, string> = {
  ORDER_CREATED: 'Orden creada',
  BUYER_PAID: 'Comprador pagó',
  ORDER_COMPLETED: 'Completada',
  ORDER_CANCELLED: 'Cancelada',
};

const DEFAULT_FORM = {
  accountId: '',
  advNo: '',
  trigger: 'ORDER_CREATED' as Trigger,
  content: '',
  delaySec: 0,
  isActive: true,
};

export default function AutoMessagesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Trigger>('ORDER_CREATED');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const { data: messages = [], isLoading } = useQuery<AutoMessage[]>({
    queryKey: ['auto-messages'],
    queryFn: () => api.get('/auto-messages').then(r => r.data),
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then(r => r.data),
  });

  const createMsg = useMutation({
    mutationFn: (data: typeof DEFAULT_FORM) =>
      api.post('/auto-messages', {
        accountId: data.accountId,
        advNo: data.advNo || undefined,
        trigger: data.trigger,
        content: data.content,
        delayMs: data.delaySec * 1000,
        isActive: data.isActive,
      }),
    onSuccess: () => {
      toast.success('Auto-mensaje creado');
      qc.invalidateQueries({ queryKey: ['auto-messages'] });
      closeModal();
    },
    onError: () => toast.error('Error al crear'),
  });

  const updateMsg = useMutation({
    mutationFn: (data: typeof DEFAULT_FORM) =>
      api.patch(`/auto-messages/${editId}`, {
        advNo: data.advNo || undefined,
        trigger: data.trigger,
        content: data.content,
        delayMs: data.delaySec * 1000,
        isActive: data.isActive,
      }),
    onSuccess: () => {
      toast.success('Auto-mensaje actualizado');
      qc.invalidateQueries({ queryKey: ['auto-messages'] });
      closeModal();
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteMsg = useMutation({
    mutationFn: (id: string) => api.delete(`/auto-messages/${id}`),
    onSuccess: () => {
      toast.success('Eliminado');
      qc.invalidateQueries({ queryKey: ['auto-messages'] });
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const openCreate = () => {
    setEditId(null);
    setForm({ ...DEFAULT_FORM, accountId: accounts[0]?.id || '' });
    setShowModal(true);
  };

  const openEdit = (msg: AutoMessage) => {
    setEditId(msg.id);
    setForm({
      accountId: msg.accountId,
      advNo: msg.advNo || '',
      trigger: msg.trigger,
      content: msg.content,
      delaySec: msg.delayMs / 1000,
      isActive: msg.isActive,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditId(null);
  };

  const handleSubmit = () => {
    if (!form.accountId || !form.content.trim()) {
      toast.error('Cuenta y contenido son requeridos');
      return;
    }
    if (editId) updateMsg.mutate(form);
    else createMsg.mutate(form);
  };

  const filtered = messages.filter(m => m.trigger === tab);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Auto-mensajes</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
          + Nuevo
        </Button>
      </div>

      {/* Trigger tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {TRIGGERS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm ${tab === t ? 'text-primary border-b-2 border-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {TRIGGER_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Sin auto-mensajes para este trigger</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-muted-foreground font-normal">Cuenta</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-normal">advNo</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-normal">Contenido</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-normal">Delay</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-normal">Activo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(msg => (
                <tr key={msg.id} className="border-t border-border hover:bg-accent/10">
                  <td className="px-4 py-3 text-foreground">{msg.account.label}</td>
                  <td className="px-4 py-3 text-muted-foreground">{msg.advNo || '(todos)'}</td>
                  <td className="px-4 py-3 text-foreground max-w-xs truncate" title={msg.content}>{msg.content}</td>
                  <td className="px-4 py-3 text-muted-foreground">{msg.delayMs / 1000}s</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${msg.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {msg.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(msg)} className="text-xs text-primary hover:underline">Editar</button>
                      <button
                        onClick={() => { if (confirm('¿Eliminar?')) deleteMsg.mutate(msg.id); }}
                        className="text-xs text-red-400 hover:underline"
                        disabled={deleteMsg.isPending}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-base font-semibold">{editId ? 'Editar' : 'Nuevo'} auto-mensaje</h2>

            {!editId && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Cuenta *</label>
                <select
                  value={form.accountId}
                  onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground"
                >
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Trigger</label>
              <select
                value={form.trigger}
                onChange={e => setForm(f => ({ ...f, trigger: e.target.value as Trigger }))}
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground"
              >
                {TRIGGERS.map(t => <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">advNo (vacío = todos)</label>
              <input
                type="text"
                value={form.advNo}
                onChange={e => setForm(f => ({ ...f, advNo: e.target.value }))}
                placeholder="Dejar vacío para todos"
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Contenido * <span className="text-muted-foreground">(vars: {'{amount} {name} {orderNo} {price}'})</span>
              </label>
              <textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground h-24 focus:outline-none focus:border-primary resize-none"
                placeholder="Hola {name}, hemos recibido tu pago..."
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Delay (segundos)</label>
              <input
                type="number"
                min={0}
                value={form.delaySec}
                onChange={e => setForm(f => ({ ...f, delaySec: Number(e.target.value) }))}
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-foreground">Activo</label>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={createMsg.isPending || updateMsg.isPending}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {createMsg.isPending || updateMsg.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={closeModal}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
