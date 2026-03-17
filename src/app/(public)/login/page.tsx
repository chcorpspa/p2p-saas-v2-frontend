'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Eye, EyeOff, Shield } from 'lucide-react';

type LoginStep = 'credentials' | '2fa';

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const doLogin = async (includeTotp = false) => {
    setError('');
    setLoading(true);
    try {
      const body: Record<string, string> = { email, password };
      if (includeTotp) body.totpToken = totpToken;

      const { data } = await api.post('/auth/login', body);
      setAuth(data.access_token, data.tenant, data.refresh_token);
      localStorage.setItem('token', data.access_token);
      document.cookie = `token=${data.access_token}; path=/; max-age=${7 * 24 * 3600}`;
      document.cookie = `refresh_token=${data.refresh_token}; path=/; max-age=${30 * 24 * 3600}`;
      router.push('/');
    } catch (err: any) {
      const msg: string = err.response?.data?.message ?? '';
      if (msg === '2FA token required') {
        setStep('2fa');
        setError('');
      } else {
        setError(msg || 'Credenciales incorrectas. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(false);
  };

  const handle2fa = (e: React.FormEvent) => {
    e.preventDefault();
    if (totpToken.length !== 6) {
      setError('El código debe tener 6 dígitos');
      return;
    }
    doLogin(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-2xl">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-base">P</span>
          </div>
          <span className="text-xl font-bold tracking-tight">CH P2P</span>
        </div>

        {step === 'credentials' ? (
          <>
            <h1 className="text-2xl font-bold mb-1">Inicia sesión</h1>
            <p className="text-sm text-muted-foreground mb-7">
              Accede a tu cuenta para gestionar tus bots
            </p>

            <form onSubmit={handleCredentials} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm"
              >
                {loading ? 'Verificando...' : 'Iniciar sesión'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              ¿No tienes cuenta?{' '}
              <Link
                href="/register"
                className="text-primary font-medium hover:underline underline-offset-4"
              >
                Regístrate →
              </Link>
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Verificación 2FA</h1>
                <p className="text-sm text-muted-foreground">
                  Ingresa el código de tu app de autenticación
                </p>
              </div>
            </div>

            <form onSubmit={handle2fa} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="totp">Código de autenticación</Label>
                <Input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="h-11 font-mono text-center text-xl tracking-widest"
                  autoFocus
                  autoComplete="one-time-code"
                />
                <p className="text-xs text-muted-foreground">
                  Código de 6 dígitos de Google Authenticator, Authy u otra app TOTP
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || totpToken.length !== 6}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm"
              >
                {loading ? 'Verificando...' : 'Confirmar'}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setTotpToken('');
                  setError('');
                }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Volver al inicio de sesión
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
