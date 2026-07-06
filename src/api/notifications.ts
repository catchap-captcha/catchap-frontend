import { client } from './client';

export interface Notification {
  id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  child_id: string | null;
  read_at: string | null;
  created_at: string;
}

export const notificationApi = {
  list: () => client.get<Notification[]>('/notifications').then((r) => r.data),
  markRead: (id: string) =>
    client.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => client.patch('/notifications/read-all').then((r) => r.data),
};
