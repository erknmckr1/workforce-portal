import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { toast } from "sonner";
import { AxiosError } from "axios";

export interface LeaveRequest {
    id?: number;
    user_id: string;
    leave_reason_id: number;
    leave_status_id?: number;
    leave_duration_type_id: number;
    auth1_user_id?: string;
    auth2_user_id?: string;
    start_date: string;
    end_date: string;
    total_days?: number;
    total_hours?: number;
    description?: string;
    phone?: string;
    address?: string;
    created_at?: string;
}

export interface LeaveLookups {
    reasons: { id: number; code: string; label: string }[];
    statuses: { id: number; code: string; label: string }[];
    durationTypes: { id: number; code: string; label: string, deduction_factor: number }[];
}

export interface ILeave {
    id: number;
    user_id: string;
    leave_reason_id: number;
    leave_status_id: number;
    leave_duration_type_id: number;
    start_date: string;
    end_date: string;
    description?: string;
    phone?: string;
    address?: string;
    auth1_responded_at?: string;
    auth2_responded_at?: string;
    exit_confirmed_at?: string;
    User?: { 
      name: string; 
      surname: string; 
      id_dec: string;
      Section?: { name: string };
    };
    LeaveReason?: { label: string };
    LeaveStatus?: { label: string; code: string };
    LeaveDurationType?: { label: string };
}

export const useLeaves = (filters?: { user_id?: string; status_id?: number; approver_id?: string }) => {
    const queryClient = useQueryClient();

    // İzin kayıtlarını çek
    const { data: leaves, isLoading: isLoadingLeaves, error: errorLeaves } = useQuery<ILeave[]>({
        queryKey: ["leaves", filters],
        queryFn: async () => {
            const { data } = await apiClient.get("/leave", { params: filters });
            return data;
        }
    });

    // İzin lookup verilerini çek
    const { data: lookups, isLoading: isLoadingLookups, error: errorLookups } = useQuery<LeaveLookups>({
        queryKey: ["leave-lookups"],
        queryFn: async () => {
            const { data } = await apiClient.get("/leave/lookups");
            return data;
        }
    });

    // Yeni izin oluştur
    const createMutation = useMutation({
        mutationFn: async (newLeave: LeaveRequest) => {
            const { data } = await apiClient.post("/leave", newLeave);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leaves"] });
            toast.success("İzin talebi başarıyla oluşturuldu.");
        },
        onError: (error: AxiosError<{message: string}>) => {
            const message = error.response?.data?.message || "İzin talebi oluşturulurken bir hata oluştu.";
            toast.error(message);
        }
    });

    const approveMutation = useMutation({
        mutationFn: async ({ id, approver_id, notes }: { id: number; approver_id: string; notes?: string }) => {
            const response = await apiClient.put(`/leave/${id}/approve`, { approver_id, notes });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leaves"] });
            toast.success("İzin talebini onayladınız.");
        },
        onError: (error: AxiosError<{message: string}>) => {
            const message = error.response?.data?.message || "Onay işlemi sırasında bir hata oluştu.";
            toast.error(message);
        }
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ id, approver_id, notes }: { id: number; approver_id: string; notes?: string }) => {
            const response = await apiClient.put(`/leave/${id}/reject`, { approver_id, notes });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leaves"] });
            toast.success("İzin talebini reddettiniz.");
        },
        onError: (error: AxiosError<{message: string}>) => {
            const message = error.response?.data?.message || "Ret işlemi sırasında bir hata oluştu.";
            toast.error(message);
        }
    });

    const cancelMutation = useMutation({
        mutationFn: async ({ id, user_id }: { id: number; user_id: string }) => {
            const response = await apiClient.put(`/leave/${id}/cancel`, { user_id });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leaves"] });
            toast.success("İzin talebi iptal edildi.");
        },
        onError: (error: AxiosError<{message: string}>) => {
            const message = error.response?.data?.message || "İptal işlemi sırasında bir hata oluştu.";
            toast.error(message);
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: Partial<LeaveRequest> & { user_id: string } }) => {
            const response = await apiClient.put(`/leave/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leaves"] });
            toast.success("İzin talebi güncellendi.");
        },
        onError: (error: AxiosError<{message: string}>) => {
            const message = error.response?.data?.message || "Güncelleme sırasında bir hata oluştu.";
            toast.error(message);
        }
    });

    const confirmExitMutation = useMutation({
        mutationFn: async ({ id, confirmed_by }: { id: number; confirmed_by: string }) => {
            const response = await apiClient.put(`/leave/${id}/confirm-exit`, { confirmed_by });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["leaves"] });
            toast.success("Çıkış onayı başarıyla kaydedildi.");
        },
        onError: (error: AxiosError<{message: string}>) => {
            const message = error.response?.data?.message || "Çıkış onayı sırasında bir hata oluştu.";
            toast.error(message);
        }
    });

    return {
        leaves: leaves || [],
        lookups: lookups || { reasons: [], statuses: [], durationTypes: [] },
        isLoading: isLoadingLeaves || isLoadingLookups,
        createLeave: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
        approveLeave: approveMutation.mutateAsync,
        isApproving: approveMutation.isPending,
        rejectLeave: rejectMutation.mutateAsync,
        isRejecting: rejectMutation.isPending,
        cancelLeave: cancelMutation.mutateAsync,
        isCancelling: cancelMutation.isPending,
        updateLeave: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,
        confirmExit: confirmExitMutation.mutateAsync,
        isConfirmingExit: confirmExitMutation.isPending,
        error: errorLeaves || errorLookups
    };
};
