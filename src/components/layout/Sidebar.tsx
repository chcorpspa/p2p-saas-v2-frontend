'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Bot, BarChart2, MessageSquare, List, Users, UserX, Calendar,
  ShieldCheck, Bell, LogOut, TrendingUp, Key, BellRing, Megaphone, Settings, X,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useNotifStore } from '@/store/notifications.store';

// ─── Navigation groups ─────────────────────────────────────────────────────

const mainLinks = [
  { href: '/',              label: 'Panel',          icon: BarChart2 },
  { href: '/bots',          label: 'Bots',           icon: Bot },
  { href: '/orders',        label: 'Órdenes',        icon: List },
  { href: '/ads',           label: 'Anuncios',       icon: Megaphone },
  { href: '/chat',          label: 'Chat',           icon: MessageSquare },
  { href: '/pnl',           label: 'P&L',            icon: TrendingUp },
  { href: '/monthly',       label: 'Panel Mensual',  icon: Calendar },
];

const settingsLinks = [
  { href: '/accounts',      label: 'Cuentas',        icon: Key },
  { href: '/operators',     label: 'Operadores',     icon: Users },
  { href: '/clients',       label: 'Clientes',       icon: UserX },
  { href: '/auto-messages', label: 'Auto-mensajes',  icon: Bell },
  { href: '/notifications', label: 'Notificaciones', icon: BellRing },
  { href: '/settings',      label: 'Configuración',  icon: Settings },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  overlay?: boolean; // Always show as overlay (for orders page full-width)
}

// ─── Nav item ──────────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  badge,
  className,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  badge?: number;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative',
        active
          ? 'bg-primary/12 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
        className,
      )}
    >
      {/* Active indicator bar */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full" />
      )}
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 transition-colors',
          active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
        )}
      />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto bg-primary text-primary-foreground text-[10px] leading-none rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────

export function Sidebar({ isOpen = true, onClose, overlay = false }: SidebarProps) {
  const pathname    = usePathname();
  const router      = useRouter();
  const tenant      = useAuthStore((s) => s.tenant);
  const logout      = useAuthStore((s) => s.logout);
  const unreadOrders = useNotifStore(s => s.unreadOrders);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  }

  // Abbreviation for avatar
  const initials = tenant?.email?.slice(0, 2).toUpperCase() ?? 'P2';

  return (
    <>
      {/* Mobile overlay */}
      {onClose && (
        <div
          className={cn(
            `fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${overlay ? '' : 'md:hidden'}`,
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          overlay ? 'fixed inset-y-0 left-0 z-50' : 'fixed md:static inset-y-0 left-0 z-50',
          'w-[220px] shrink-0 flex flex-col h-full',
          'border-r border-sidebar-border',
          'transition-transform duration-200',
          'backdrop-blur-xl',
          isOpen ? 'translate-x-0' : (overlay ? '-translate-x-full' : '-translate-x-full md:translate-x-0'),
        )}
        style={{ background: 'oklch(0.08 0.018 280 / 85%)' }}
      >
        {/* Mobile close */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 md:hidden text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* ── Logo ─────────────────────────────────── */}
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            {/* CH P2P logo mark */}
            <div
              className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center font-bold text-sm text-white"
              style={{
                background: 'linear-gradient(135deg, oklch(0.60 0.28 280), oklch(0.48 0.26 280))',
                boxShadow: '0 0 14px oklch(0.58 0.28 280 / 40%)',
              }}
            >
              P
            </div>
            <div>
              <p className="font-bold text-sm leading-none tracking-tight" style={{ color: 'oklch(0.80 0.20 280)' }}>
                CH P2P
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">Trading Bot</p>
            </div>
          </div>
        </div>

        {/* ── Navigation ───────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">

          {/* Main group */}
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
            Principal
          </p>
          {mainLinks.map(({ href, label, icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={isActive(href)}
              badge={href === '/orders' ? unreadOrders : undefined}
              onClick={onClose}
            />
          ))}

          {/* Settings group */}
          <p className="px-3 mt-4 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
            Configuración
          </p>
          {settingsLinks.map(({ href, label, icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={isActive(href)}
              onClick={onClose}
            />
          ))}

          {/* Admin */}
          {tenant?.isAdmin && (
            <>
              <p className="px-3 mt-4 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
                Sistema
              </p>
              <NavItem
                href="/admin"
                label="Admin"
                icon={ShieldCheck}
                active={isActive('/admin')}
                onClick={onClose}
                className={isActive('/admin') ? '' : 'text-yellow-500/70 hover:text-yellow-500'}
              />
            </>
          )}
        </nav>

        {/* ── Footer ───────────────────────────────── */}
        <div className="border-t border-sidebar-border px-3 py-3">
          {/* User info */}
          <div className="flex items-center gap-2.5 px-1 mb-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-primary">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground font-medium truncate leading-none">
                {tenant?.email?.split('@')[0] ?? 'Usuario'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-none capitalize">
                {tenant?.plan ?? 'free'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all duration-150"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
