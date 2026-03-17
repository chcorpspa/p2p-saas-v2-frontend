import { create } from 'zustand';

interface NotifState {
  unreadOrders: number;
  incrementUnread: () => void;
  clearUnread: () => void;
}

export const useNotifStore = create<NotifState>((set) => ({
  unreadOrders: 0,
  incrementUnread: () => set(s => ({ unreadOrders: s.unreadOrders + 1 })),
  clearUnread: () => set({ unreadOrders: 0 }),
}));
