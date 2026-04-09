import { create } from 'zustand';
import { type Personnel } from '@/hooks/usePersonnel';

interface ModuleState {
  isPopupOpen: boolean;
  selectedFlow: string;
  user: Personnel | null;
  openPopup: () => void;
  closePopup: () => void;
  setSelectedFlow: (flow: string) => void;
  setUser: (user: Personnel | null) => void;
}

export const useModuleStore = create<ModuleState>((set) => ({
  isPopupOpen: false,
  selectedFlow: "Talep Oluştur",
  user: null,
  
  openPopup: () => set({ isPopupOpen: true }),
  
  closePopup: () => set({ 
    isPopupOpen: false, 
    selectedFlow: "Talep Oluştur",
    user: null
  }),
  
  setSelectedFlow: (flow) => set({ selectedFlow: flow }),
  
  setUser: (user) => set({ user }),
}));
