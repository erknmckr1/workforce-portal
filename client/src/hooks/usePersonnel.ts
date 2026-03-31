import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";

export interface LookupItem {
  id: number | string;
  name: string;
}

export interface Personnel {
  id_dec: string;
  id_hex: string;
  name: string;
  surname: string;
  nick_name?: string;
  short_name?: string;
  email?: string;
  gender?: string;
  address?: string;
  role_id: number;
  section?: number | string;
  department?: number | string;
  title?: number | string;
  auth1?: string;
  auth2?: string;
  leave_balance: number;
  route?: string;
  stop_name?: string;
  is_active: number;
  Role?: LookupItem;
  Section?: LookupItem;
  Department?: LookupItem;
  JobTitle?: LookupItem;
  Auth1?: { name: string; surname: string };
  Auth2?: { name: string; surname: string };
}
export interface PersonnelResponse {
  data: Personnel[];
  total: number;
  page: number;
  totalPages: number;
}

// useQuery veri okuma, useMutation yaz, güncelle, sil
export const usePersonnel = (page: number = 1, limit: number = 50, search: string = "") => {
  const queryClient = useQueryClient();

  const query = useQuery<PersonnelResponse>({
    queryKey: ["personnel", page, limit, search],
    queryFn: async () => {
      const resp = await apiClient.get("/personnel", {
        params: { page, limit, search }
      });
      return resp.data;
    },
    placeholderData: (previousData) => previousData, // Sayfa geçişlerinde ekranın boşalmasını önler
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Personnel> & { password?: string }) => {
      return apiClient.post("/personnel", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Personnel> & { password?: string } }) => {
      return apiClient.put(`/personnel/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/personnel/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
    },
  });

  return {
    ...query,
    createMutation,
    updateMutation,
    deleteMutation,
  };
};
