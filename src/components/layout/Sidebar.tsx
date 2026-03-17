'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Bot, BarChart2, MessageSquare, List, Megaphone, Users, Settings } from 'lucide-react';

const links = [
  { href: '/', label: 'Overview', icon: BarChart2 },
  { href: '/bots', label: 'Bots', icon: Bot },
  { href: '/orders', label: 'Órdenes', icon: List },
  { href: '/pnl', label: 'P&L', icon: BarChart2 },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/ads', label: 'Anuncios', icon: Megaphone },
  { href: '/operators', label: 'Operadores', icon: Users },
  { href: '/settings', label: 'Configuración', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 border-r bg-muted/30 flex flex-col p-4 gap-1">
      <div className="font-bold text-lg mb-4 px-2">P2P Bot SaaS</div>
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors',
            pathname === href && 'bg-accent font-medium',
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </aside>
  );
}
