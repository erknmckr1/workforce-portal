import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";

export interface PhoneEntry {
  id?: number;
  number: string;
  name: string;
  department: string;
}

export const usePhoneDirectory = (search?: string) => {
  const queryClient = useQueryClient();

  const directoryQuery = useQuery<PhoneEntry[]>({
    queryKey: ["phone-directory", search],
    queryFn: async () => {
      const resp = await apiClient.get("/phone-directory", {
        params: { search },
      });
      return resp.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PhoneEntry) => {
      return apiClient.post("/phone-directory", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phone-directory"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: PhoneEntry }) => {
      return apiClient.put(`/phone-directory/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phone-directory"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete(`/phone-directory/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phone-directory"] });
    },
  });

  return {
    directoryQuery,
    createMutation,
    updateMutation,
    deleteMutation,
  };
};
