'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Send } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Account {
  id: number;
  label: string;
  isMerchant: boolean;
  isActive: boolean;
}

interface NotificationConfig {
  telegramToken: string | null;
  telegramChatId: string | null;
  notifyNewOrder: boolean;
  notifyBuyerPaid: boolean;
  notifyCompleted: boolean;
  notifyCancelled: boolean;
}

interface FormState {
  telegramToken: string;
  telegramChatId: string;
  notifyNewOrder: boolean;
  notifyBuyerPaid: boolean;
  notifyCompleted: boolean;
  notifyCancelled: boolean;
}

const defaultForm: FormState = {
  telegramToken: '',
  telegramChatId: '',
  notifyNewOrder: true,
  notifyBuyerPaid: true,
  notifyCompleted: true,
  notifyCancelled: false,
};

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function ConfigSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-4 w-40 mb-3" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between py-3">
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);

  // Fetch accounts list
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await api.get<Account[]>('/accounts');
      return res.data;
    },
  });

  // Set default selected account when accounts load
  useEffect(() => {
    if (accounts.length > 0 && selectedAccountId === null) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Fetch notification config for selected account
  const {
    data: config,
    isLoading: loadingConfig,
    isFetching: fetchingConfig,
  } = useQuery<NotificationConfig>({
    queryKey: ['notifications-config', selectedAccountId],
    queryFn: async () => {
      const res = await api.get<NotificationConfig>(
        `/notifications/accounts/${selectedAccountId}/config`,
      );
      return res.data;
    },
    enabled: selectedAccountId !== null,
  });

  // Populate form when config loads
  useEffect(() => {
    if (config) {
      setForm({
        telegramToken: config.telegramToken ?? '',
        telegramChatId: config.telegramChatId ?? '',
        notifyNewOrder: config.notifyNewOrder,
        notifyBuyerPaid: config.notifyBuyerPaid,
        notifyCompleted: config.notifyCompleted,
        notifyCancelled: config.notifyCancelled,
      });
    } else if (!loadingConfig) {
      setForm(defaultForm);
    }
  }, [config, loadingConfig]);

  // Reset form when account changes
  const handleAccountChange = (value: string) => {
    setSelectedAccountId(Number(value));
    setForm(defaultForm);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: FormState) => {
      await api.post(`/notifications/accounts/${selectedAccountId}/config`, {
        telegramToken: data.telegramToken || null,
        telegramChatId: data.telegramChatId || null,
        notifyNewOrder: data.notifyNewOrder,
        notifyBuyerPaid: data.notifyBuyerPaid,
        notifyCompleted: data.notifyCompleted,
        notifyCancelled: data.notifyCancelled,
      });
    },
    onSuccess: () => {
      toast.success('Configuración guardada');
      queryClient.invalidateQueries({ queryKey: ['notifications-config', selectedAccountId] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Error al guardar la configuración';
      toast.error(message);
    },
  });

  const handleSave = () => {
    if (selectedAccountId === null) return;
    saveMutation.mutate(form);
  };

  const handleTest = () => {
    toast.info('Funcionalidad próximamente');
  };

  const isFormLoading = loadingConfig || fetchingConfig;
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificaciones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configura alertas de Telegram por cuenta
          </p>
        </div>
      </div>

      {/* Account selector */}
      {loadingAccounts ? (
        <Skeleton className="h-10 w-64" />
      ) : accounts.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground">
          No hay cuentas disponibles. Crea una cuenta para configurar notificaciones.
        </div>
      ) : accounts.length === 1 ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Cuenta:</span>
          <span className="text-sm font-medium">{accounts[0].label}</span>
          {accounts[0].isMerchant && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              Merchant
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">
            Seleccionar cuenta:
          </Label>
          <Select
            value={selectedAccountId?.toString() ?? ''}
            onValueChange={handleAccountChange}
          >
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Selecciona una cuenta" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id.toString()}>
                  <span className="flex items-center gap-2">
                    {account.label}
                    {account.isMerchant && (
                      <span className="text-xs text-primary font-medium">Merchant</span>
                    )}
                    {!account.isActive && (
                      <span className="text-xs text-muted-foreground">(inactiva)</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Config form */}
      {selectedAccountId !== null && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          {/* Section title */}
          <div>
            <h2 className="text-base font-semibold">
              Configuración de Telegram
              {selectedAccount && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  — {selectedAccount.label}
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Las notificaciones se enviarán a través de tu bot de Telegram configurado.
            </p>
          </div>

          {isFormLoading ? (
            <ConfigSkeleton />
          ) : (
            <>
              {/* Telegram Token */}
              <div className="space-y-1.5">
                <Label htmlFor="telegram-token" className="text-sm font-medium">
                  Telegram Token
                </Label>
                <Input
                  id="telegram-token"
                  type="text"
                  placeholder="bot123456:ABC-DEF..."
                  value={form.telegramToken}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, telegramToken: e.target.value }))
                  }
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Token de tu bot Telegram. Obtenerlo hablando con{' '}
                  <span className="text-primary font-medium">@BotFather</span> en Telegram.
                </p>
              </div>

              {/* Telegram Chat ID */}
              <div className="space-y-1.5">
                <Label htmlFor="telegram-chat-id" className="text-sm font-medium">
                  Telegram Chat ID
                </Label>
                <Input
                  id="telegram-chat-id"
                  type="text"
                  placeholder="-1001234567890 o 123456789"
                  value={form.telegramChatId}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, telegramChatId: e.target.value }))
                  }
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  ID del chat o grupo donde recibir notificaciones. Usa{' '}
                  <span className="text-primary font-medium">@userinfobot</span> para obtener
                  tu ID.
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Toggles */}
              <div className="space-y-1">
                <h3 className="text-sm font-medium mb-3">Notificar cuando...</h3>

                <div className="space-y-0.5">
                  {/* New order */}
                  <div className="flex items-center justify-between py-3 border-b border-border/50">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="notify-new-order"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Nueva orden creada
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Recibir alerta cuando se cree una nueva orden P2P
                      </p>
                    </div>
                    <Switch
                      id="notify-new-order"
                      checked={form.notifyNewOrder}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({ ...prev, notifyNewOrder: checked }))
                      }
                    />
                  </div>

                  {/* Buyer paid */}
                  <div className="flex items-center justify-between py-3 border-b border-border/50">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="notify-buyer-paid"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Comprador marcó como pagado
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Recibir alerta cuando el comprador confirme el pago
                      </p>
                    </div>
                    <Switch
                      id="notify-buyer-paid"
                      checked={form.notifyBuyerPaid}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({ ...prev, notifyBuyerPaid: checked }))
                      }
                    />
                  </div>

                  {/* Completed */}
                  <div className="flex items-center justify-between py-3 border-b border-border/50">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="notify-completed"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Orden completada
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Recibir alerta cuando una orden se complete exitosamente
                      </p>
                    </div>
                    <Switch
                      id="notify-completed"
                      checked={form.notifyCompleted}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({ ...prev, notifyCompleted: checked }))
                      }
                    />
                  </div>

                  {/* Cancelled */}
                  <div className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="notify-cancelled"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Orden cancelada
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Recibir alerta cuando una orden sea cancelada
                      </p>
                    </div>
                    <Switch
                      id="notify-cancelled"
                      checked={form.notifyCancelled}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({ ...prev, notifyCancelled: checked }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleTest}
                  className="sm:w-auto w-full gap-2"
                  disabled={saveMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                  Enviar mensaje de prueba
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="sm:flex-1 w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                >
                  {saveMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
