import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import type { CompanySurvey, SurveyFormData } from "@/types/survey";
import { toast } from "sonner";

// MES, Kiosk ve Portal için aktif anketleri çeker
export const useActiveSurveys = (platform: "MES" | "KIOSK" | "PORTAL" = "MES") => {
  return useQuery<CompanySurvey[]>({
    queryKey: ["activeSurveys", platform],
    queryFn: async () => {
      const res = await apiClient.get(`/surveys/active?platform=${platform}`);
      return res.data.data || [];
    },
    refetchInterval: 30000, // 30 saniyede bir otomatik yenile
    staleTime: 5000, // 5 saniye sonra bayat kabul et
    refetchOnWindowFocus: true, // Ekrana dokunulduğunda/odaklanıldığında anında tazele
  });
};

// Ayarlar paneli için tüm anketleri çeker ve yönetim mutasyonlarını sunar
export const useSurveys = () => {
  const queryClient = useQueryClient();

  const query = useQuery<CompanySurvey[]>({
    queryKey: ["allSurveys"],
    queryFn: async () => {
      const res = await apiClient.get("/surveys");
      return res.data.data || [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["allSurveys"] });
    queryClient.invalidateQueries({ queryKey: ["activeSurveys"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: SurveyFormData) => {
      const res = await apiClient.post("/surveys", data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Yeni anket başarıyla eklendi.");
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Anket eklenirken bir hata oluştu.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SurveyFormData> }) => {
      const res = await apiClient.put(`/surveys/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Anket güncellendi.");
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Anket güncellenirken hata oluştu.");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.patch(`/surveys/${id}/toggle`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Anket durumu değiştirildi.");
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Durum değiştirilemedi.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/surveys/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Anket başarıyla silindi.");
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Anket silinemedi.");
    },
  });

  return {
    surveys: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    createSurvey: createMutation.mutateAsync,
    updateSurvey: updateMutation.mutateAsync,
    toggleSurvey: toggleMutation.mutateAsync,
    deleteSurvey: deleteMutation.mutateAsync,
    isSubmitting:
      createMutation.isPending ||
      updateMutation.isPending ||
      toggleMutation.isPending ||
      deleteMutation.isPending,
  };
};
