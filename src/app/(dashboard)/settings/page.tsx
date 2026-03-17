'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Lock, Shield, ShieldCheck, ShieldOff, X, Loader2 } from 'lucide-react';

interface MeResponse {
  id: string;
  email: string;
  plan: string;
  has2fa: boolean;
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

// ─── 2FA Setup Modal ──────────────────────────────────────────────────────────

type SetupStep = 'qr' | 'verify';

function Setup2faModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<SetupStep>('qr');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [setupDone, setSetupDone] = useState(false);

  const initSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/2fa/setup');
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setSetupDone(true);
    } catch {
      setError('Error al generar el código QR. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-init on mount
  useEffect(() => {
    initSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async () => {
    if (token.length !== 6) {
      setError('El código debe tener 6 dígitos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/2fa/verify', { token });
      toast.success('2FA activado correctamente');
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Código incorrecto. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Activar 2FA</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${step === 'qr' ? 'bg-primary text-primary-foreground' : 'bg-green-500 text-white'}`}>
              {step === 'verify' ? '✓' : '1'}
            </div>
            <div className="flex-1 h-px bg-border" />
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${step === 'verify' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              2
            </div>
          </div>

          {step === 'qr' && (
            <>
              <p className="text-sm text-muted-foreground">
                Escanea el código QR con tu app de autenticación (Google Authenticator, Authy, etc.)
              </p>

              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {qrCode && (
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-white p-3 rounded-xl">
                    <img src={qrCode} alt="QR Code 2FA" className="w-44 h-44" />
                  </div>

                  <details className="w-full">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                      ¿No puedes escanear? Entrada manual
                    </summary>
                    <div className="mt-2 bg-muted/50 rounded-lg px-3 py-2">
                      <p className="text-xs text-muted-foreground mb-1">Clave secreta:</p>
                      <code className="text-xs font-mono text-foreground break-all">{secret}</code>
                    </div>
                  </details>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                onClick={() => setStep('verify')}
                disabled={!setupDone || loading}
                className="w-full"
              >
                Ya lo escaneé → Verificar
              </Button>
            </>
          )}

          {step === 'verify' && (
            <>
              <p className="text-sm text-muted-foreground">
                Ingresa el código de 6 dígitos que muestra tu app de autenticación para confirmar la configuración.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="totp-setup">Código de verificación</Label>
                <Input
                  id="totp-setup"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  className="font-mono text-center text-lg tracking-widest"
                  autoFocus
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('qr')} className="flex-1">
                  Atrás
                </Button>
                <Button
                  onClick={handleVerify}
                  disabled={loading || token.length !== 6}
                  className="flex-1"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activar 2FA'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 2FA Disable Modal ────────────────────────────────────────────────────────

function Disable2faModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDisable = async () => {
    if (token.length !== 6) {
      setError('El código debe tener 6 dígitos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.delete('/auth/2fa', { data: { token } });
      toast.success('2FA desactivado');
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Código incorrecto. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold">Desactivar 2FA</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Ingresa tu código de autenticación actual para confirmar que deseas desactivar el 2FA.
          </p>

          <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
            <p className="text-xs text-destructive font-medium">
              ⚠️ Esto reducirá la seguridad de tu cuenta
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="totp-disable">Código de autenticación</Label>
            <Input
              id="totp-disable"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && handleDisable()}
              className="font-mono text-center text-lg tracking-widest"
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={loading || token.length !== 6}
              className="flex-1"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Desactivar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Anti-Phishing Card ───────────────────────────────────────────────────────

function AntiPhishingCard() {
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentCode, setCurrentCode] = useState<string | null>(null);

  useEffect(() => {
    api.get('/auth/anti-phishing').then(r => setCurrentCode(r.data.code ?? null)).catch(() => {});
  }, []);

  async function saveCode() {
    if (!code.trim()) return;
    setSaving(true);
    try {
      await api.put('/auth/anti-phishing', { code: code.trim() });
      toast.success('Código anti-phishing guardado');
      setCurrentCode(code.trim());
      setCode('');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div>
        <h2 className="font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Código Anti-Phishing
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Este código se mostrará en la barra superior para verificar que estás en el sitio legítimo.
        </p>
      </div>
      {currentCode && (
        <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
          ✓ Código configurado (se muestra en el header)
        </p>
      )}
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="Tu código secreto (máx 20 caracteres)"
          maxLength={20}
          className="flex-1"
        />
        <Button size="sm" onClick={saveCode} disabled={saving || !code.trim()}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const qc = useQueryClient();

  const { data: me } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [showSetup2fa, setShowSetup2fa] = useState(false);
  const [showDisable2fa, setShowDisable2fa] = useState(false);

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
      const msg = err?.response?.data?.message || 'Error al cambiar la contraseña';
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

  const handle2faSuccess = () => {
    setShowSetup2fa(false);
    setShowDisable2fa(false);
    qc.invalidateQueries({ queryKey: ['me'] });
  };

  const planKey = (me?.plan ?? 'FREE').toUpperCase();
  const badgeClass = planBadge[planKey] ?? planBadge.FREE;
  const has2fa = me?.has2fa ?? false;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Configuración</h1>

      {/* Profile card */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">Mi perfil</h2>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">Email</Label>
            <p className="text-sm text-muted-foreground bg-muted/50 border border-border rounded-md px-3 py-2">
              {me?.email ?? '—'}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">Plan</Label>
            <div>
              <Badge className={`text-xs font-semibold uppercase ${badgeClass}`}>{planKey}</Badge>
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
          {formError && <p className="text-sm text-destructive">{formError}</p>}
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
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {has2fa ? (
              <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
            ) : (
              <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <div>
              <h2 className="font-semibold">Autenticación de dos factores</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {has2fa
                  ? 'Tu cuenta está protegida con autenticación de dos factores'
                  : 'Añade una capa extra de seguridad a tu cuenta'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {has2fa ? (
              <>
                <Badge className="bg-green-500/20 text-green-400 text-xs font-semibold hidden sm:flex">
                  Activo
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDisable2fa(true)}
                  className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60 hover:bg-destructive/10"
                >
                  Desactivar
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setShowSetup2fa(true)}>
                Activar 2FA
              </Button>
            )}
          </div>
        </div>

        {has2fa && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Se requiere un código de tu app de autenticación cada vez que inicias sesión.
              Usa Google Authenticator, Authy u otra app compatible con TOTP.
            </p>
          </div>
        )}
      </div>

      {/* Anti-phishing code */}
      <AntiPhishingCard />

      {/* Modals */}
      {showSetup2fa && (
        <Setup2faModal
          onClose={() => setShowSetup2fa(false)}
          onSuccess={handle2faSuccess}
        />
      )}
      {showDisable2fa && (
        <Disable2faModal
          onClose={() => setShowDisable2fa(false)}
          onSuccess={handle2faSuccess}
        />
      )}
    </div>
  );
}
