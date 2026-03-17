'use client';
import { useState } from 'react';
import { SocketProvider } from '@/lib/socket';
import { Sidebar } from '@/components/layout/Sidebar';
import { Menu } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SocketProvider>
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
    </SocketProvider>
  );
}
