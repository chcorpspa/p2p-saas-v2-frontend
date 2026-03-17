'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit2, X, ShieldAlert, Star } from 'lucide-react';

interface ClientEntry {
  id: string;
  nickname: string;
  listType: 'blacklist' | 'whitelist';
  reason: string;
  notes: string;
  createdAt: string;
}

type Tab = 'all' | 'blacklist' | 'whitelist';

const inputClass = 'w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15';

export default function ClientsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [listType, setListType] = useState<'blacklist' | 'whitelist'>('blacklist');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const { data: clients = [], isLoading } = useQuery<ClientEntry[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then(r => r.data).catch(() => []),
  });

  const filtered = clients.filter(c => tab === 'all' || c.listType === tab);

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { nickname, listType, reason, notes };
      return editId
        ? api.patch(`/clients/${editId}`, body)
        : api.post('/clients', body);
    },
    onSuccess: () => {
      toast.success(editId ? 'Cliente actualizado' : 'Cliente agregado');
      qc.invalidateQueries({ queryKey: ['clients'] });
      closeModal();
    },
    onError: () => toast.error('Error al guardar'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      toast.success('Cliente eliminado');
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: () => toast.error('Error al eliminar'),
  });

  function openCreate() {
    setEditId(null);
    setNickname('');
    setListType('blacklist');
    setReason('');
    setNotes('');
    setShowModal(true);
  }

  function openEdit(c: ClientEntry) {
    setEditId(c.id);
    setNickname(c.nickname);
    setListType(c.listType);
    setReason(c.reason);
    setNotes(c.notes);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditId(null);
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Lista de Clientes</h1>
        <Button size="sm" className="bg-primary text-primary-foreground" onClick={openCreate}>
          <Plus size={15} /> Agregar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(['all', 'blacklist', 'whitelist'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              tab === t
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
          >
            {t === 'all' ? 'Todos' : t === 'blacklist' ? '🔴 Bloqueados' : '⭐ VIP'}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground self-center">{filtered.length} registros</span>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm py-10 text-center">Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShieldAlert className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Sin clientes en la lista</p>
          <p className="text-xs mt-1">Agrega nicknames de Binance para bloquear o marcar como VIP</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              {/* Icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                c.listType === 'blacklist' ? 'bg-red-500/15 text-red-400' : 'bg-yellow-500/15 text-yellow-400'
              }`}>
                {c.listType === 'blacklist' ? <ShieldAlert size={16} /> : <Star size={16} />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{c.nickname}</p>
                <p className="text-xs text-muted-foreground truncate">{c.reason}</p>
                {c.notes && <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{c.notes}</p>}
              </div>

              {/* Badge */}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                c.listType === 'blacklist' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {c.listType === 'blacklist' ? 'BLOQUEADO' : 'VIP'}
              </span>

              {/* Actions */}
              <button onClick={() => openEdit(c)} className="text-muted-foreground hover:text-foreground p-1">
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => { if (window.confirm('¿Eliminar?')) deleteMut.mutate(c.id); }}
                className="text-red-400 hover:text-red-300 p-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-[#111827] border border-primary/20 rounded-2xl p-5 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">{editId ? 'Editar' : 'Agregar'} Cliente</h3>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Nickname (Binance)</label>
                <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Nombre exacto en Binance" className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Tipo de lista</label>
                <select value={listType} onChange={e => setListType(e.target.value as 'blacklist' | 'whitelist')} className={inputClass}>
                  <option value="blacklist">🔴 Blacklist (Bloqueado)</option>
                  <option value="whitelist">⭐ Whitelist (VIP)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Razón (requerida)</label>
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo del bloqueo o preferencia" className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Notas internas (opcional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionales..." className={inputClass + ' h-20 resize-none'} />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1" onClick={closeModal}>Cancelar</Button>
              <Button className="flex-1 bg-primary text-primary-foreground" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !nickname.trim() || !reason.trim()}>
                {saveMut.isPending ? 'Guardando...' : editId ? 'Actualizar' : 'Agregar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
