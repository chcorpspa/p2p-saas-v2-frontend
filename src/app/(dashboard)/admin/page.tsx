'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';

interface Tenant {
  id: string;
  email: string;
  plan: string;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string;
  _count: { accounts: number; bots: number; orders: number };
}

interface Stats {
  tenants: number;
  orders: number;
  bots: number;
}

const PLANS = ['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'];

export default function AdminPage() {
  const tenant = useAuthStore((s) => s.tenant);
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant?.isAdmin) { router.replace('/'); return; }
    Promise.all([
      api.get('/admin/tenants').then((r) => setTenants(r.data)),
      api.get('/admin/stats').then((r) => setStats(r.data)),
    ]).finally(() => setLoading(false));
  }, [tenant, router]);

  async function updatePlan(id: string, plan: string) {
    setSaving(id);
    try {
      const r = await api.patch(`/admin/tenants/${id}`, { plan });
      setTenants((prev) => prev.map((t) => (t.id === id ? { ...t, plan: r.data.plan } : t)));
    } finally {
      setSaving(null);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    setSaving(id);
    try {
      const r = await api.patch(`/admin/tenants/${id}`, { isActive: !isActive });
      setTenants((prev) => prev.map((t) => (t.id === id ? { ...t, isActive: r.data.isActive } : t)));
    } finally {
      setSaving(null);
    }
  }

  async function resetPassword(id: string) {
    const newPassword = window.prompt('Nueva contraseña (mín 8 chars):');
    if (!newPassword) return;
    if (newPassword.length < 8) {
      alert('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setSaving(id + '-reset');
    try {
      await api.patch(`/admin/tenants/${id}/reset-password`, { newPassword });
      alert('Contraseña reseteada exitosamente');
    } catch {
      alert('Error al resetear contraseña');
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Panel Admin</h1>

      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Tenants', value: stats.tenants },
            { label: 'Órdenes totales', value: stats.orders.toLocaleString() },
            { label: 'Bots activos', value: stats.bots },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Plan</th>
              <th className="text-left p-3">Estado</th>
              <th className="text-left p-3">Cuentas / Bots / Órdenes</th>
              <th className="text-left p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{t.email}</div>
                  {t.isAdmin && <span className="text-xs text-yellow-500">admin</span>}
                </td>
                <td className="p-3">
                  <select
                    value={t.plan}
                    onChange={(e) => updatePlan(t.id, e.target.value)}
                    disabled={saving === t.id}
                    className="border rounded px-2 py-1 text-sm bg-background"
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <Badge variant={t.isActive ? 'default' : 'destructive'}>
                    {t.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                <td className="p-3 text-muted-foreground">
                  {t._count.accounts} / {t._count.bots} / {t._count.orders.toLocaleString()}
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={t.isActive ? 'destructive' : 'outline'}
                      disabled={saving === t.id}
                      onClick={() => toggleActive(t.id, t.isActive)}
                    >
                      {t.isActive ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={saving === t.id + '-reset'}
                      onClick={() => resetPassword(t.id)}
                    >
                      Reset Pass
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
