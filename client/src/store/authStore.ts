import { create } from "zustand";

interface User {
  id_dec: string;
  name: string;
  surname: string;
  role: string;
  permissions: string[];
  leave_balance: number;
  photo_url?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (userData: User) => void;
  logout: () => void;
  setCheckingAuth: (status: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // Uygulama ilk açıldığında sunucuya sorulana kadar yükleniyor...
  
  login: (userData) => set({ user: userData, isAuthenticated: true, isLoading: false }),
  
  logout: () => set({ user: null, isAuthenticated: false, isLoading: false }),
  
  setCheckingAuth: (status) => set({ isLoading: status })
}));
