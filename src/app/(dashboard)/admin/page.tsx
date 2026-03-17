'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, FileText, Trash2, Key, Calendar } from 'lucide-react';

interface Tenant {
  id: string;
  email: string;
  plan: string;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string;
  planExpiresAt?: string;
  notes?: string;
  _count: { accounts: number; bots: number; orders: number };
}

interface Stats {
  tenants: number;
  orders: number;
  bots: number;
}

const PLANS = ['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'];
const PLAN_BADGES: Record<string, string> = {
  TRIAL: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  BASIC: 'bg-green-500/20 text-green-400 border-green-500/30',
  PRO: 'bg-primary/20 text-primary border-primary/30',
  ENTERPRISE: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function expiryColor(days: number | null): string {
  if (days === null) return 'text-muted-foreground';
  if (days <= 0) return 'text-red-500';
  if (days <= 3) return 'text-red-400';
  if (days <= 7) return 'text-orange-400';
  return 'text-green-400';
}

export default function AdminPage() {
  const tenant = useAuthStore((s) => s.tenant);
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Modals
  const [planModal, setPlanModal] = useState<Tenant | null>(null);
  const [planValue, setPlanValue] = useState('TRIAL');
  const [planDays, setPlanDays] = useState('30');
  const [notesModal, setNotesModal] = useState<Tenant | null>(null);
  const [notesValue, setNotesValue] = useState('');

  useEffect(() => {
    if (!tenant?.isAdmin) { router.replace('/'); return; }
    Promise.all([
      api.get('/admin/tenants').then((r) => setTenants(r.data)),
      api.get('/admin/stats').then((r) => setStats(r.data)),
    ]).finally(() => setLoading(false));
  }, [tenant, router]);

  async function updatePlan() {
    if (!planModal) return;
    setSaving(planModal.id);
    try {
      const r = await api.patch(`/admin/tenants/${planModal.id}`, {
        plan: planValue,
        planDays: parseInt(planDays) || 30,
      });
      setTenants(prev => prev.map(t => t.id === planModal.id ? { ...t, plan: r.data.plan, planExpiresAt: r.data.planExpiresAt } : t));
      toast.success('Plan actualizado');
      setPlanModal(null);
    } catch {
      toast.error('Error al actualizar plan');
    } finally {
      setSaving(null);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    setSaving(id);
    try {
      const r = await api.patch(`/admin/tenants/${id}`, { isActive: !isActive });
      setTenants(prev => prev.map(t => t.id === id ? { ...t, isActive: r.data.isActive } : t));
      toast.success(isActive ? 'Desactivado' : 'Activado');
    } finally { setSaving(null); }
  }

  async function resetPassword(id: string) {
    const newPassword = window.prompt('Nueva contraseña (mín 8 chars):');
    if (!newPassword || newPassword.length < 8) {
      if (newPassword) toast.error('Mínimo 8 caracteres');
      return;
    }
    setSaving(id + '-reset');
    try {
      await api.patch(`/admin/tenants/${id}/reset-password`, { newPassword });
      toast.success('Contraseña reseteada');
    } catch { toast.error('Error'); }
    finally { setSaving(null); }
  }

  async function saveNotes() {
    if (!notesModal) return;
    setSaving(notesModal.id + '-notes');
    try {
      await api.patch(`/admin/tenants/${notesModal.id}`, { notes: notesValue });
      setTenants(prev => prev.map(t => t.id === notesModal.id ? { ...t, notes: notesValue } : t));
      toast.success('Notas guardadas');
      setNotesModal(null);
    } catch { toast.error('Error'); }
    finally { setSaving(null); }
  }

  async function deleteTenant(t: Tenant) {
    if (!window.confirm(`¿Eliminar ${t.email}? Se borrarán todos sus bots, cuentas y datos. Esta acción no se puede deshacer.`)) return;
    setSaving(t.id + '-del');
    try {
      await api.delete(`/admin/tenants/${t.id}`);
      setTenants(prev => prev.filter(x => x.id !== t.id));
      toast.success('Usuario eliminado');
    } catch { toast.error('Error al eliminar'); }
    finally { setSaving(null); }
  }

  if (loading) return <div className="p-8 text-muted-foreground">Cargando...</div>;

  // Stat breakdowns
  const active = tenants.filter(t => t.isActive).length;
  const pending = tenants.filter(t => !t.isActive).length;
  const trialCount = tenants.filter(t => t.plan === 'TRIAL').length;
  const basicCount = tenants.filter(t => t.plan === 'BASIC').length;
  const proCount = tenants.filter(t => t.plan === 'PRO').length;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">Panel Admin</h1>

      {/* Stats grid — like old system */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: tenants.length, color: 'text-foreground' },
          { label: 'Pendientes', value: pending, color: 'text-orange-400' },
          { label: 'Activos', value: active, color: 'text-green-400' },
          { label: 'Sin plan', value: tenants.filter(t => !t.plan || t.plan === 'NONE').length, color: 'text-muted-foreground' },
          { label: 'Trial', value: trialCount, color: 'text-blue-400' },
          { label: 'Basic', value: basicCount, color: 'text-green-400' },
          { label: 'Pro', value: proCount, color: 'text-primary' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/3">
            <tr className="text-xs text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-4 py-3">#</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-left px-4 py-3">Vence</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="text-left px-4 py-3">Bots</th>
              <th className="text-left px-4 py-3">Registro</th>
              <th className="text-left px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t, i) => {
              const days = daysUntil(t.planExpiresAt);
              return (
                <tr key={t.id} className="border-t border-border hover:bg-white/2">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{t.email}</div>
                    {t.isAdmin && <span className="text-[10px] text-primary font-semibold">admin</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { setPlanModal(t); setPlanValue(t.plan); setPlanDays('30'); }}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded border cursor-pointer hover:opacity-80 ${PLAN_BADGES[t.plan] || 'bg-white/5 text-muted-foreground border-border'}`}
                    >
                      {t.plan || 'NONE'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {t.planExpiresAt ? (
                      <span className={`text-xs font-medium ${expiryColor(days)}`}>
                        {days !== null && days <= 0 ? 'Expirado' : `${days}d`}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={t.isActive ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}>
                      {t.isActive ? 'Activa' : 'Pendiente'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t._count.accounts}/{t._count.bots}/{t._count.orders.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString('es-VE')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <Button size="sm" variant={t.isActive ? 'destructive' : 'outline'} disabled={saving === t.id} onClick={() => toggleActive(t.id, t.isActive)} className="text-xs h-7 px-2">
                        {t.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                      <button onClick={() => resetPassword(t.id)} disabled={saving === t.id + '-reset'} className="h-7 px-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-white/5" title="Reset contraseña">
                        <Key size={12} />
                      </button>
                      <button onClick={() => { setNotesModal(t); setNotesValue(t.notes || ''); }} className="h-7 px-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-white/5" title="Notas">
                        <FileText size={12} />
                      </button>
                      <button onClick={() => deleteTenant(t)} disabled={saving === t.id + '-del'} className="h-7 px-2 rounded border border-red-500/30 text-xs text-red-400 hover:bg-red-500/10" title="Eliminar">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Plan Modal */}
      {planModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setPlanModal(null)}>
          <div className="bg-[#111827] border border-primary/20 rounded-2xl p-5 w-full max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2"><Calendar size={16} /> Cambiar Plan</h3>
              <button onClick={() => setPlanModal(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">{planModal.email}</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Plan</label>
                <select value={planValue} onChange={e => setPlanValue(e.target.value)} className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground">
                  <option value="NONE">Sin plan</option>
                  {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Duración (días)</label>
                <input type="number" value={planDays} onChange={e => setPlanDays(e.target.value)} min="1" className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground font-mono" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Vence: {new Date(Date.now() + (parseInt(planDays) || 30) * 86400000).toLocaleDateString('es-VE')}
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => setPlanModal(null)}>Cancelar</Button>
              <Button className="flex-1 bg-primary text-primary-foreground" onClick={updatePlan} disabled={saving === planModal.id}>
                {saving === planModal.id ? 'Guardando...' : 'Aplicar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setNotesModal(null)}>
          <div className="bg-[#111827] border border-primary/20 rounded-2xl p-5 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2"><FileText size={16} /> Notas — {notesModal.email}</h3>
              <button onClick={() => setNotesModal(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <textarea
              value={notesValue}
              onChange={e => setNotesValue(e.target.value)}
              className="w-full bg-white/6 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground h-40 resize-none focus:outline-none focus:border-primary/60"
              placeholder="Notas de pago, observaciones, historial..."
            />
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setNotesModal(null)}>Cancelar</Button>
              <Button className="flex-1 bg-primary text-primary-foreground" onClick={saveNotes} disabled={saving === notesModal.id + '-notes'}>
                {saving === notesModal.id + '-notes' ? 'Guardando...' : 'Guardar notas'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
