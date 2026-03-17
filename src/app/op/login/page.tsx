'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const operatorId = params.get('id') ?? '';
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in as operator, redirect
  useEffect(() => {
    const token = localStorage.getItem('op_token');
    if (token) router.replace('/op/orders');
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorId) { toast.error('Link inválido — falta el ID de operador'); return; }
    if (!pin) { toast.error('Ingresa tu PIN'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/operators/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId, pin }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'PIN incorrecto');
      }
      const data = await res.json();
      localStorage.setItem('op_token', data.access_token);
      localStorage.setItem('op_name', data.name);
      localStorage.setItem('op_advnos', JSON.stringify(data.advNos));
      toast.success(`Bienvenido, ${data.name}`);
      router.replace('/op/orders');
    } catch (err: any) {
      toast.error(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: '#08060f',
        backgroundImage: `
          radial-gradient(ellipse 70% 50% at -5% -5%, oklch(0.58 0.28 280 / 14%) 0%, transparent 60%),
          radial-gradient(ellipse 55% 40% at 105% 100%, oklch(0.50 0.15 220 / 8%) 0%, transparent 55%)
        `,
        backgroundAttachment: 'fixed',
        fontFamily: "'Outfit', 'Segoe UI', sans-serif",
      }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, oklch(0.58 0.28 280), oklch(0.45 0.22 300))' }}>
            <span className="text-white text-2xl font-bold">P</span>
          </div>
          <h1 className="text-2xl font-bold text-white">CH P2P</h1>
          <p className="text-sm mt-1" style={{ color: 'oklch(0.55 0.05 280)' }}>Panel de Operador</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 space-y-5"
          style={{
            background: 'oklch(0.10 0.018 280 / 90%)',
            border: '1px solid oklch(0.58 0.28 280 / 20%)',
            backdropFilter: 'blur(20px)',
          }}>
          {!operatorId ? (
            <div className="text-center py-4">
              <p className="text-red-400 text-sm">Link inválido. Solicita un nuevo link a tu administrador.</p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs block mb-1.5" style={{ color: 'oklch(0.55 0.05 280)' }}>
                  PIN de acceso
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white tracking-[0.5em] focus:outline-none transition-colors"
                  style={{
                    background: 'oklch(0.07 0.015 280)',
                    border: '1px solid oklch(0.58 0.28 280 / 30%)',
                  }}
                  placeholder="••••"
                  maxLength={16}
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all"
                style={{
                  background: loading
                    ? 'oklch(0.58 0.28 280 / 50%)'
                    : 'linear-gradient(135deg, oklch(0.58 0.28 280), oklch(0.50 0.25 300))',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Verificando...' : 'Iniciar sesión'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OperatorLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
