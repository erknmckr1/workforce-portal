import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api";

export interface FoodMenuEntry {
    id?: number;
    menu_date: string;
    items: string; // Initially from API it's a JSON string
    note?: string;
}

export interface ParsedFoodMenuEntry extends Omit<FoodMenuEntry, 'items'> {
    parsedItems: string[];
}

export const useFoodMenu = (year?: string, month?: string) => {
    const queryClient = useQueryClient();

    const monthlyQuery = useQuery<ParsedFoodMenuEntry[]>({
        queryKey: ["food-menu", year, month],
        queryFn: async () => {
            if (!year || !month) return [];
            const resp = await apiClient.get("/food-menu/monthly", {
                params: { year, month }
            });
            // Parse JSON items for easier use in components
            return resp.data.map((entry: FoodMenuEntry) => ({
                ...entry,
                parsedItems: JSON.parse(entry.items || "[]")
            }));
        },
        enabled: !!year && !!month
    });

    const todayQuery = useQuery<ParsedFoodMenuEntry | null>({
        queryKey: ["food-menu", "today"],
        queryFn: async () => {
            try {
                const resp = await apiClient.get("/food-menu/today");
                return {
                    ...resp.data,
                    parsedItems: JSON.parse(resp.data.items || "[]")
                };
            } catch (error: any) {
                if (error.response?.status === 404) return null;
                throw error;
            }
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (data: { menu_date: string; items: string[]; note?: string }) => {
            return apiClient.post("/food-menu/update", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["food-menu"] });
        }
    });

    const bulkUpdateMutation = useMutation({
        mutationFn: async (menuData: { menu_date: string; items: string[]; note?: string }[]) => {
            return apiClient.post("/food-menu/bulk-update", { menuData });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["food-menu"] });
        }
    });

    return {
        monthlyQuery,
        todayQuery,
        updateMutation,
        bulkUpdateMutation
    };
};
