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
      <main className="flex-1 overflow-auto relative">
        {/* Mobile hamburger */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-30 md:hidden p-2 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
        {children}
      </main>
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
