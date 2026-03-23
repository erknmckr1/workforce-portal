import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api";

export interface LookupItem {
  id: number | string;
  name: string;
}

export interface LookupSection extends LookupItem {
  manager_id?: string | null;
}

export interface LookupDepartment extends LookupItem {
  supervisor_id?: string | null;
}

export interface Lookups {
  roles: LookupItem[];
  sections: LookupSection[];
  departments: LookupDepartment[];
  titles: LookupItem[];
}

export const useLookups = () => {
  return useQuery<Lookups>({
    queryKey: ["lookups"],
    queryFn: async () => {
      const resp = await apiClient.get("/personnel/lookups");
      return resp.data;
    },
    staleTime: Infinity, // Lookups rarely change
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
  });
};
