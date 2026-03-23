import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";
import { toast } from "sonner";

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
    User?: { name: string; surname: string; id_dec: string };
    LeaveReason?: { label: string };
    LeaveStatus?: { label: string; code: string };
    LeaveDurationType?: { label: string };
}

export const useLeaves = (filters?: { user_id?: string; status_id?: number; approver_id?: string }) => {
    const queryClient = useQueryClient();

    // İzin kayıtlarını çek
    const leavesQuery = useQuery({
        queryKey: ["leaves", filters],
        queryFn: async () => {
            const { data } = await apiClient.get("/leave", { params: filters });
            return data;
        }
    });

    // İzin lookup verilerini çek
    const lookupsQuery = useQuery<LeaveLookups>({
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
            toast.success("İzin talebi başarıyla oluşturuldu.");
            queryClient.invalidateQueries({ queryKey: ["leaves"] });
        },
        onError: (error: unknown) => {
            const message = (error as any).response?.data?.message || "İzin oluşturulurken bir hata oluştu.";
            toast.error(message);
        }
    });

    return {
        leaves: leavesQuery.data || [],
        isLoading: leavesQuery.isLoading,
        lookups: lookupsQuery.data || { reasons: [], statuses: [], durationTypes: [] },
        lookupsLoading: lookupsQuery.isLoading,
        createLeave: createMutation.mutateAsync,
        isCreating: createMutation.isPending
    };
};
