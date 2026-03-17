'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Users, Plus, Key, Copy, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';

interface Operator {
  id: string;
  name: string;
  advNos: string[];
  isActive: boolean;
  role?: string;
  permissions?: string[];
  pnlAccess?: boolean;
}

type Role = 'operator' | 'admin' | 'viewer';
const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: 'operator', label: 'Operador', desc: 'Acceso a órdenes y chat según anuncios asignados' },
  { value: 'admin', label: 'Admin', desc: 'Acceso completo excepto configuración de cuenta' },
  { value: 'viewer', label: 'Visor', desc: 'Solo lectura — no puede ejecutar acciones' },
];

const PERMISSIONS = [
  { key: 'view_orders', label: 'Ver órdenes' },
  { key: 'send_chat', label: 'Enviar chat' },
  { key: 'mark_paid', label: 'Marcar pagado' },
  { key: 'release', label: 'Liberar cripto' },
  { key: 'cancel', label: 'Cancelar orden' },
  { key: 'manage_ads', label: 'Gestionar anuncios' },
];

const DEFAULT_FORM = {
  name: '',
  advNos: '',
  isActive: true,
  role: 'operator' as Role,
  permissions: ['view_orders', 'send_chat', 'mark_paid', 'release'] as string[],
  pnlAccess: false,
};

export default function OperatorsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [pinModal, setPinModal] = useState<string | null>(null); // operatorId
  const [pin, setPin] = useState('');

  const { data: operators = [], isLoading } = useQuery<Operator[]>({
    queryKey: ['operators'],
    queryFn: () => api.get('/operators').then(r => r.data),
  });

  const createOp = useMutation({
    mutationFn: () => api.post('/operators', {
      name: form.name,
      advNos: form.advNos.split(',').map((s: string) => s.trim()).filter(Boolean),
      isActive: form.isActive,
      role: form.role,
      permissions: form.permissions,
      pnlAccess: form.pnlAccess,
    }),
    onSuccess: () => { toast.success('Operador creado'); qc.invalidateQueries({ queryKey: ['operators'] }); closeModal(); },
    onError: () => toast.error('Error al crear'),
  });

  const updateOp = useMutation({
    mutationFn: () => api.patch(`/operators/${editId}`, {
      name: form.name,
      advNos: form.advNos.split(',').map((s: string) => s.trim()).filter(Boolean),
      isActive: form.isActive,
      role: form.role,
      permissions: form.permissions,
      pnlAccess: form.pnlAccess,
    }),
    onSuccess: () => { toast.success('Actualizado'); qc.invalidateQueries({ queryKey: ['operators'] }); closeModal(); },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteOp = useMutation({
    mutationFn: (id: string) => api.delete(`/operators/${id}`),
    onSuccess: () => { toast.success('Eliminado'); qc.invalidateQueries({ queryKey: ['operators'] }); },
    onError: () => toast.error('Error al eliminar'),
  });

  const setOpPin = useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: string }) => api.patch(`/operators/${id}/pin`, { pin }),
    onSuccess: () => { toast.success('PIN actualizado'); setPinModal(null); setPin(''); },
    onError: () => toast.error('Error al actualizar PIN'),
  });

  const openCreate = () => { setEditId(null); setForm(DEFAULT_FORM); setShowModal(true); };
  const openEdit = (op: Operator) => {
    setEditId(op.id);
    setForm({
      name: op.name,
      advNos: op.advNos.join(', '),
      isActive: op.isActive,
      role: (op.role as Role) || 'operator',
      permissions: op.permissions || ['view_orders', 'send_chat', 'mark_paid', 'release'],
      pnlAccess: op.pnlAccess || false,
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditId(null); };

  const copyLoginLink = (op: Operator) => {
    const url = `${window.location.origin}/op/login?id=${op.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado al portapapeles');
  };

  return (
    <div className="p-6 space-y-6 animate-[fadeInUp_0.4s_ease]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Operadores</h1>
            <p className="text-xs text-muted-foreground">Gestiona el acceso de tu equipo</p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo operador
        </Button>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : operators.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Sin operadores</p>
            <p className="text-muted-foreground/50 text-xs mt-1">Crea el primero con el botón de arriba</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3.5 text-muted-foreground font-medium text-xs uppercase tracking-wider">Nombre</th>
                <th className="text-left px-5 py-3.5 text-muted-foreground font-medium text-xs uppercase tracking-wider">advNos</th>
                <th className="text-left px-5 py-3.5 text-muted-foreground font-medium text-xs uppercase tracking-wider">Estado</th>
                <th className="px-5 py-3.5 text-right text-muted-foreground font-medium text-xs uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {operators.map(op => (
                <tr key={op.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold">
                        {op.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground">{op.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {op.advNos.length === 0 ? (
                        <span className="text-muted-foreground/50">—</span>
                      ) : op.advNos.map(a => (
                        <span key={a} className="inline-block bg-primary/10 border border-primary/20 text-primary text-xs px-2 py-0.5 rounded-md font-mono">
                          {a}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {op.isActive ? (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400 w-fit">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Activo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground w-fit">
                        <XCircle className="w-3.5 h-3.5" />
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => copyLoginLink(op)}
                        title="Copiar link de acceso"
                        className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setPinModal(op.id); setPin(''); }}
                        title="Establecer PIN"
                        className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-amber-400 transition-colors"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEdit(op)}
                        title="Editar"
                        className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`¿Eliminar a ${op.name}?`)) deleteOp.mutate(op.id); }}
                        title="Eliminar"
                        className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-red-400 transition-colors"
                        disabled={deleteOp.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info banner */}
      <div className="glass-card rounded-xl p-4 border border-primary/10 bg-primary/5">
        <p className="text-xs text-muted-foreground">
          <span className="text-primary font-medium">¿Cómo funciona?</span>{' '}
          Crea un operador, asígnale los <code className="bg-primary/10 px-1 rounded text-primary">advNos</code> que debe gestionar,
          establece un PIN con <Key className="w-3 h-3 inline" /> y copia su link de acceso con <Copy className="w-3 h-3 inline" />.
          El operador podrá ver y gestionar solo las órdenes de sus anuncios.
        </p>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-5 animate-[fadeInUp_0.2s_ease]">
            <h2 className="text-base font-semibold text-foreground">
              {editId ? 'Editar' : 'Nuevo'} operador
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  placeholder="Rosa López"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  advNos <span className="text-muted-foreground/50">(separados por coma)</span>
                </label>
                <input
                  type="text"
                  value={form.advNos}
                  onChange={e => setForm(f => ({ ...f, advNos: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:border-primary/50 transition-colors"
                  placeholder="12345678, 87654321"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-foreground">Activo</span>
                <button
                  onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? 'bg-primary' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.isActive ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              {/* Role */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Rol</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                  ))}
                </select>
              </div>

              {/* Permissions */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Permisos</label>
                <div className="space-y-1.5">
                  {PERMISSIONS.map(p => (
                    <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(p.key)}
                        onChange={() => setForm(f => ({
                          ...f,
                          permissions: f.permissions.includes(p.key)
                            ? f.permissions.filter(x => x !== p.key)
                            : [...f.permissions, p.key],
                        }))}
                        className="accent-primary w-3.5 h-3.5"
                      />
                      <span className="text-foreground">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* P&L access */}
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-foreground">Acceso a P&L</span>
                <button
                  onClick={() => setForm(f => ({ ...f, pnlAccess: !f.pnlAccess }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.pnlAccess ? 'bg-primary' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.pnlAccess ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => {
                  if (!form.name.trim()) { toast.error('Nombre requerido'); return; }
                  editId ? updateOp.mutate() : createOp.mutate();
                }}
                disabled={createOp.isPending || updateOp.isPending}
                className="flex-1 btn-primary"
              >
                {createOp.isPending || updateOp.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={closeModal}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      {pinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-5 animate-[fadeInUp_0.2s_ease]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Key className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Establecer PIN</h2>
                <p className="text-xs text-muted-foreground">El operador usará este PIN para iniciar sesión</p>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">PIN (mínimo 4 caracteres)</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground tracking-[0.5em] focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="••••"
                maxLength={16}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  if (pin.length < 4) { toast.error('El PIN debe tener al menos 4 caracteres'); return; }
                  setOpPin.mutate({ id: pinModal, pin });
                }}
                disabled={setOpPin.isPending}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                {setOpPin.isPending ? 'Guardando...' : 'Guardar PIN'}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => { setPinModal(null); setPin(''); }}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
