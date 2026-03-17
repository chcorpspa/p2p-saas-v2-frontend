'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Lock, Shield } from 'lucide-react';

interface MeResponse {
  id: string;
  email: string;
  plan: string;
}

const planBadge: Record<string, string> = {
  FREE: 'bg-muted text-muted-foreground',
  TRIAL: 'bg-blue-500/20 text-blue-400',
  BASIC: 'bg-green-500/20 text-green-400',
  PRO: 'bg-yellow-500/20 text-primary',
};

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { data: me } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');

  const mutation = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.patch('/auth/password', body).then((r) => r.data),
    onSuccess: () => {
      toast.success('Contraseña actualizada correctamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFormError('');
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message || 'Error al cambiar la contraseña';
      setFormError(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (newPassword.length < 8) {
      setFormError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('Las contraseñas no coinciden');
      return;
    }

    mutation.mutate({ currentPassword, newPassword });
  }

  const planKey = (me?.plan ?? 'FREE').toUpperCase();
  const badgeClass = planBadge[planKey] ?? planBadge.FREE;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Configuración</h1>

      {/* Profile card */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          Mi perfil
        </h2>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              Email
            </Label>
            <p className="text-sm text-muted-foreground bg-muted/50 border border-border rounded-md px-3 py-2">
              {me?.email ?? '—'}
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              Plan
            </Label>
            <div>
              <Badge className={`text-xs font-semibold uppercase ${badgeClass}`}>
                {planKey}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Change password card */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          Cambiar contraseña
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Contraseña actual</Label>
            <PasswordInput
              id="currentPassword"
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">Nueva contraseña</Label>
            <PasswordInput
              id="newPassword"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
            <PasswordInput
              id="confirmPassword"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="••••••••"
            />
          </div>

          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}

          <Button
            type="submit"
            disabled={mutation.isPending || !currentPassword || !newPassword || !confirmPassword}
            className="w-full sm:w-auto"
          >
            {mutation.isPending ? 'Guardando...' : 'Actualizar contraseña'}
          </Button>
        </form>
      </div>

      {/* 2FA card */}
      <div className="bg-card border border-border rounded-xl p-6 opacity-60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">Autenticación de dos factores</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Añade una capa extra de seguridad a tu cuenta
              </p>
            </div>
          </div>
          <Badge className="bg-muted text-muted-foreground text-xs">
            Próximamente
          </Badge>
        </div>
      </div>
    </div>
  );
}
