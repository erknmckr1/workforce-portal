import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";

export interface INotification {
  id: number;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  related_id?: number;
  created_at: string;
}

interface NotificationsResponse {
  notifications: INotification[];
  unreadCount: number;
}

export function useNotifications() {
  const queryClient = useQueryClient();

  // BİLDİRİMLERİ GETİR (POLLING: Her 30 saniyede bir sessizce kontrol et)
  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await apiClient.get("/notifications/my");
      return response.data;
    },
    refetchInterval: 60000, // 60 saniye
    staleTime: 60000,
  });

  // TEK BİR BİLDİRİMİ OKUNDU İŞARETLE
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.put(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // TÜMÜNÜ OKUNDU İŞARETLE
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.put("/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    notifications: data?.notifications || [],
    unreadCount: data?.unreadCount || 0,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
  };
}
