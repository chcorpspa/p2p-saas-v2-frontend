'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Bot, BarChart2, MessageSquare, List, Users,
  ShieldCheck, Bell, LogOut, TrendingUp, Key, BellRing, Megaphone, Settings,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

const links = [
  { href: '/', label: 'Overview', icon: BarChart2 },
  { href: '/bots', label: 'Bots', icon: Bot },
  { href: '/orders', label: 'Órdenes', icon: List },
  { href: '/ads', label: 'Anuncios', icon: Megaphone },
  { href: '/pnl', label: 'P&L', icon: TrendingUp },
  { href: '/accounts', label: 'Cuentas', icon: Key },
  { href: '/operators', label: 'Operadores', icon: Users },
  { href: '/auto-messages', label: 'Auto-mensajes', icon: Bell },
  { href: '/notifications', label: 'Notificaciones', icon: BellRing },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/settings', label: 'Configuración', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const tenant = useAuthStore((s) => s.tenant);
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <aside className="w-[220px] shrink-0 border-r border-border bg-sidebar flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">P</span>
          </div>
          <span className="font-bold text-foreground tracking-tight">P2P Bot</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'text-primary font-medium bg-primary/10 border-l-2 border-primary pl-[10px]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        {tenant?.isAdmin && (
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors mt-2',
              pathname === '/admin'
                ? 'text-primary font-medium bg-primary/10 border-l-2 border-primary pl-[10px]'
                : 'text-yellow-500/80 hover:text-yellow-500 hover:bg-accent/50',
            )}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Admin
          </Link>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground truncate mb-2 px-1">{tenant?.email}</p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
