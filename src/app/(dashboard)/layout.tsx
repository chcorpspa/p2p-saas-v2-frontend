'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { SocketProvider, useSocket } from '@/lib/socket';
import { Sidebar } from '@/components/layout/Sidebar';
import { Menu } from 'lucide-react';
import { useNotifStore } from '@/store/notifications.store';

function DashboardInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const socket = useSocket();
  const incrementUnread = useNotifStore(s => s.incrementUnread);
  const clearUnread = useNotifStore(s => s.clearUnread);

  useEffect(() => {
    if (pathname === '/orders') clearUnread();
  }, [pathname, clearUnread]);

  useEffect(() => {
    if (!socket) return;
    const onChatMessage = () => { if (pathname !== '/orders') incrementUnread(); };
    socket.on('chat:message', onChatMessage);
    return () => { socket.off('chat:message', onChatMessage); };
  }, [socket, pathname, incrementUnread]);

  // Orders page: sidebar hidden by default, opens as overlay via hamburger
  const isOrdersPage = pathname === '/orders';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        overlay={isOrdersPage}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar: always visible on orders, only mobile on other pages */}
        <div
          className={`flex items-center gap-3 px-4 py-2 shrink-0 ${isOrdersPage ? '' : 'md:hidden'}`}
          style={{ background: 'rgba(8,11,20,0.92)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] text-white"
              style={{ background: 'linear-gradient(135deg, oklch(0.60 0.28 280), oklch(0.48 0.26 280))' }}>
              P
            </div>
            <span className="font-bold text-sm" style={{ color: 'oklch(0.80 0.20 280)' }}>CH P2P</span>
          </div>
        </div>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      <DashboardInner>{children}</DashboardInner>
    </SocketProvider>
  );
}
