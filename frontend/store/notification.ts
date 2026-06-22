import { create } from "zustand";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
}

interface NotificationState {
  items: AppNotification[];
  upsert: (items: AppNotification[]) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  upsert: (items) => set({ items }),
  markAsRead: (id) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, is_read: true } : item,
      ),
    })),
  clearAll: () => set({ items: [] }),
}));
