'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
  id: string;
  label: string;
  isMerchant: boolean;
  isActive: boolean;
  createdAt: string;
}

interface ServiceState {
  monitor: boolean;
  pnl: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/>
      <path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}

function CreditCardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  );
}

// ─── Add Account Modal ────────────────────────────────────────────────────────

interface AddAccountModalProps {
  onClose: () => void;
}

function AddAccountModal({ onClose }: AddAccountModalProps) {
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const resetForm = () => {
    setLabel('');
    setApiKey('');
    setApiSecret('');
    setShowSecret(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const createAccount = useMutation({
    mutationFn: (body: { label: string; apiKey: string; apiSecret: string }) =>
      api.post('/accounts', body).then(r => r.data),
    onSuccess: () => {
      toast.success('Cuenta agregada correctamente');
      qc.invalidateQueries({ queryKey: ['accounts'] });
      handleClose();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const msg = err?.response?.data?.message ?? 'Error al agregar la cuenta';
      toast.error(typeof msg === 'string' ? msg : 'Error al agregar la cuenta');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) { toast.error('El nombre es requerido'); return; }
    if (!apiKey.trim()) { toast.error('El API Key es requerido'); return; }
    if (!apiSecret.trim()) { toast.error('El API Secret es requerido'); return; }
    createAccount.mutate({
      label: label.trim(),
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md space-y-4 shadow-xl">
        <h2 className="text-base font-semibold text-foreground">Agregar Cuenta Binance</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Label */}
          <div className="space-y-1.5">
            <label htmlFor="acc-label" className="text-xs text-muted-foreground block">
              Nombre / Etiqueta <span className="text-red-400">*</span>
            </label>
            <input
              id="acc-label"
              type="text"
              placeholder="ej. Mr_Nasdaq"
              value={label}
              onChange={e => setLabel(e.target.value)}
              autoComplete="off"
              className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <label htmlFor="acc-apikey" className="text-xs text-muted-foreground block">
              API Key <span className="text-red-400">*</span>
            </label>
            <input
              id="acc-apikey"
              type="text"
              placeholder="Binance API Key"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-secondary border border-border rounded px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* API Secret */}
          <div className="space-y-1.5">
            <label htmlFor="acc-apisecret" className="text-xs text-muted-foreground block">
              API Secret <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                id="acc-apisecret"
                type={showSecret ? 'text' : 'password'}
                placeholder="Binance API Secret"
                value={apiSecret}
                onChange={e => setApiSecret(e.target.value)}
                autoComplete="new-password"
                spellCheck={false}
                className="w-full bg-secondary border border-border rounded px-3 py-2 pr-10 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowSecret(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showSecret ? 'Ocultar secret' : 'Mostrar secret'}
              >
                {showSecret ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={createAccount.isPending}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {createAccount.isPending ? 'Guardando...' : 'Agregar Cuenta'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={handleClose}
              disabled={createAccount.isPending}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Toggle Button ────────────────────────────────────────────────────────────

interface ToggleBtnProps {
  on: boolean;
  pending: boolean;
  labelOn: string;
  labelOff: string;
  colorOn: 'green' | 'gold';
  onClick: () => void;
}

function ToggleBtn({ on, pending, labelOn, labelOff, colorOn, onClick }: ToggleBtnProps) {
  const onClass =
    colorOn === 'green'
      ? 'bg-green-500/20 text-green-400 border-green-500/40 hover:bg-green-500/30'
      : 'bg-primary/20 text-primary border-primary/40 hover:bg-primary/30';

  const dotClass = colorOn === 'green' ? 'bg-green-400' : 'bg-primary';

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        on
          ? onClass
          : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
      }`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${on ? dotClass : 'bg-muted-foreground'}`} />
      {on ? labelOn : labelOff}
    </button>
  );
}

// ─── Account Row ──────────────────────────────────────────────────────────────

interface AccountRowProps {
  account: Account;
  monitorOn: boolean;
  pnlOn: boolean;
  monitorPending: boolean;
  pnlPending: boolean;
  deletePending: boolean;
  onMonitorToggle: () => void;
  onPnlToggle: () => void;
  onDelete: () => void;
}

function AccountRow({
  account,
  monitorOn,
  pnlOn,
  monitorPending,
  pnlPending,
  deletePending,
  onMonitorToggle,
  onPnlToggle,
  onDelete,
}: AccountRowProps) {
  return (
    <tr className="border-b border-border hover:bg-accent/20 transition-colors">
      {/* Label */}
      <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">
        {account.label}
      </td>

      {/* Merchant type badge */}
      <td className="px-4 py-3 whitespace-nowrap">
        {account.isMerchant ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary border border-primary/30">
            Merchant
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
            Standard
          </span>
        )}
      </td>

      {/* Active status badge */}
      <td className="px-4 py-3 whitespace-nowrap">
        {account.isActive ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
            Activa
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
            Inactiva
          </span>
        )}
      </td>

      {/* Created date */}
      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
        {fmtDate(account.createdAt)}
      </td>

      {/* Monitor toggle */}
      <td className="px-4 py-3 whitespace-nowrap">
        <ToggleBtn
          on={monitorOn}
          pending={monitorPending}
          labelOn="Monitor ON"
          labelOff="Monitor OFF"
          colorOn="green"
          onClick={onMonitorToggle}
        />
      </td>

      {/* P&L toggle */}
      <td className="px-4 py-3 whitespace-nowrap">
        <ToggleBtn
          on={pnlOn}
          pending={pnlPending}
          labelOn="P&L ON"
          labelOff="P&L OFF"
          colorOn="gold"
          onClick={onPnlToggle}
        />
      </td>

      {/* Delete */}
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <button
          onClick={onDelete}
          disabled={deletePending}
          title="Eliminar cuenta"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <TrashIcon />
          Eliminar
        </button>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  // Optimistic per-account service state
  const [serviceState, setServiceState] = useState<Record<string, ServiceState>>({});
  // Track in-flight requests per action key
  const [pending, setPending] = useState<Record<string, boolean>>({});
  // Track which account is being deleted
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Fetch accounts ──────────────────────────────────────────────────────────

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then(r => r.data),
    refetchInterval: 30000,
  });

  // ── Delete mutation ─────────────────────────────────────────────────────────

  const deleteAccount = useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: (_data, id) => {
      toast.success('Cuenta eliminada');
      setServiceState(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: () => {
      setDeletingId(null);
      toast.error('Error al eliminar la cuenta');
    },
  });

  // ── Service state helpers ───────────────────────────────────────────────────

  const getState = (id: string): ServiceState =>
    serviceState[id] ?? { monitor: false, pnl: false };

  const handleMonitorToggle = async (account: Account) => {
    const key = `${account.id}_monitor`;
    if (pending[key]) return;
    const current = getState(account.id).monitor;
    const endpoint = current
      ? `/orders/accounts/${account.id}/monitor/stop`
      : `/orders/accounts/${account.id}/monitor/start`;

    setPending(p => ({ ...p, [key]: true }));
    try {
      await api.post(endpoint);
      setServiceState(prev => ({
        ...prev,
        [account.id]: { ...getState(account.id), monitor: !current },
      }));
      toast.success(current ? 'Monitor detenido' : 'Monitor iniciado');
    } catch {
      toast.error(current ? 'Error al detener monitor' : 'Error al iniciar monitor');
    } finally {
      setPending(p => ({ ...p, [key]: false }));
    }
  };

  const handlePnlToggle = async (account: Account) => {
    const key = `${account.id}_pnl`;
    if (pending[key]) return;
    const current = getState(account.id).pnl;
    const endpoint = current
      ? `/pnl/accounts/${account.id}/tracker/stop`
      : `/pnl/accounts/${account.id}/tracker/start`;

    setPending(p => ({ ...p, [key]: true }));
    try {
      await api.post(endpoint);
      setServiceState(prev => ({
        ...prev,
        [account.id]: { ...getState(account.id), pnl: !current },
      }));
      toast.success(current ? 'P&L Tracker detenido' : 'P&L Tracker iniciado');
    } catch {
      toast.error(current ? 'Error al detener P&L Tracker' : 'Error al iniciar P&L Tracker');
    } finally {
      setPending(p => ({ ...p, [key]: false }));
    }
  };

  const handleDelete = (account: Account) => {
    const confirmed = window.confirm(
      `¿Eliminar la cuenta "${account.label}"?\n\nEsta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    setDeletingId(account.id);
    deleteAccount.mutate(account.id);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Cuentas Binance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestiona las cuentas API conectadas al P2P Bot
          </p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
        >
          + Agregar Cuenta
        </Button>
      </div>

      {/* Table card */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Cargando cuentas...
          </div>
        ) : accounts.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
              <CreditCardIcon />
            </div>
            <p className="text-muted-foreground text-sm text-center max-w-xs">
              No hay cuentas configuradas. Agrega tu primera cuenta Binance.
            </p>
            <Button
              onClick={() => setShowAdd(true)}
              variant="secondary"
              size="sm"
              className="mt-1"
            >
              + Agregar Cuenta
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Cuenta
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Creada
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Monitor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    P&L Tracker
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(account => {
                  const state = getState(account.id);
                  return (
                    <AccountRow
                      key={account.id}
                      account={account}
                      monitorOn={state.monitor}
                      pnlOn={state.pnl}
                      monitorPending={!!pending[`${account.id}_monitor`]}
                      pnlPending={!!pending[`${account.id}_pnl`]}
                      deletePending={deletingId === account.id}
                      onMonitorToggle={() => handleMonitorToggle(account)}
                      onPnlToggle={() => handlePnlToggle(account)}
                      onDelete={() => handleDelete(account)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer row count */}
        {accounts.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border bg-background/20">
            <p className="text-xs text-muted-foreground">
              {accounts.length} cuenta{accounts.length !== 1 ? 's' : ''} configurada{accounts.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      {showAdd && <AddAccountModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
