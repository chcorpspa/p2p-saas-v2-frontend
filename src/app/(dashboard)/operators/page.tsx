'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Operator {
  id: string;
  name: string;
  advNos: string[];
  isActive: boolean;
}

const DEFAULT_FORM = { name: '', advNos: '', isActive: true };

export default function OperatorsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const { data: operators = [], isLoading } = useQuery<Operator[]>({
    queryKey: ['operators'],
    queryFn: () => api.get('/operators').then(r => r.data),
  });

  const createOp = useMutation({
    mutationFn: () => api.post('/operators', {
      name: form.name,
      advNos: form.advNos.split(',').map(s => s.trim()).filter(Boolean),
      isActive: form.isActive,
    }),
    onSuccess: () => { toast.success('Operador creado'); qc.invalidateQueries({ queryKey: ['operators'] }); closeModal(); },
    onError: () => toast.error('Error al crear'),
  });

  const updateOp = useMutation({
    mutationFn: () => api.patch(`/operators/${editId}`, {
      name: form.name,
      advNos: form.advNos.split(',').map(s => s.trim()).filter(Boolean),
      isActive: form.isActive,
    }),
    onSuccess: () => { toast.success('Actualizado'); qc.invalidateQueries({ queryKey: ['operators'] }); closeModal(); },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteOp = useMutation({
    mutationFn: (id: string) => api.delete(`/operators/${id}`),
    onSuccess: () => { toast.success('Eliminado'); qc.invalidateQueries({ queryKey: ['operators'] }); },
    onError: () => toast.error('Error al eliminar'),
  });

  const openCreate = () => { setEditId(null); setForm(DEFAULT_FORM); setShowModal(true); };
  const openEdit = (op: Operator) => { setEditId(op.id); setForm({ name: op.name, advNos: op.advNos.join(', '), isActive: op.isActive }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditId(null); };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Operadores</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">+ Nuevo</Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : operators.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Sin operadores</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-muted-foreground font-normal">Nombre</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-normal">advNos</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-normal">Activo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {operators.map(op => (
                <tr key={op.id} className="border-t border-border hover:bg-accent/10">
                  <td className="px-4 py-3 font-medium text-foreground">{op.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {op.advNos.length === 0 ? '—' : op.advNos.map(a => (
                      <span key={a} className="inline-block bg-secondary border border-border text-xs px-2 py-0.5 rounded mr-1">{a}</span>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${op.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {op.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(op)} className="text-xs text-primary hover:underline">Editar</button>
                      <button
                        onClick={() => { if (confirm('¿Eliminar operador?')) deleteOp.mutate(op.id); }}
                        className="text-xs text-red-400 hover:underline"
                        disabled={deleteOp.isPending}
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

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-base font-semibold">{editId ? 'Editar' : 'Nuevo'} operador</h2>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nombre *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                placeholder="Rosa López"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">advNos (separados por coma)</label>
              <input
                type="text"
                value={form.advNos}
                onChange={e => setForm(f => ({ ...f, advNos: e.target.value }))}
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                placeholder="12345678, 87654321"
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
                onClick={() => { if (!form.name.trim()) { toast.error('Nombre requerido'); return; } editId ? updateOp.mutate() : createOp.mutate(); }}
                disabled={createOp.isPending || updateOp.isPending}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {createOp.isPending || updateOp.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={closeModal}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
