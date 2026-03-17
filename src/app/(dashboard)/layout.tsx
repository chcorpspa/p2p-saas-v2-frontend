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

  // Clear badge when user visits orders page
  useEffect(() => {
    if (pathname === '/orders') clearUnread();
  }, [pathname, clearUnread]);

  // Increment badge on incoming chat messages when not on orders page
  useEffect(() => {
    if (!socket) return;
    const onChatMessage = () => {
      if (pathname !== '/orders') incrementUnread();
    };
    socket.on('chat:message', onChatMessage);
    return () => { socket.off('chat:message', onChatMessage); };
  }, [socket, pathname, incrementUnread]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border md:hidden shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-[9px]">P2</span>
            </div>
            <span className="font-semibold text-sm">P2P Bot</span>
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
