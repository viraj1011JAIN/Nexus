import { create } from "zustand";

/**
 * SENIOR ARCHITECTURE NOTE:
 * Using a centralized store for the modal allows us to trigger 
 * the 'view' or 'edit' states from anywhere in the board 
 * without prop drilling, keeping the UI highly responsive.
 */

type CardModalStore = {
  id?: string;
  isOpen: boolean;
  mode: "view" | "edit"; 
  onOpen: (id: string, mode?: "view" | "edit") => void; 
  onClose: () => void;
};

export const useCardModal = create<CardModalStore>((set) => ({
  id: undefined,
  isOpen: false,
  mode: "view",
  
  // onOpen triggers the modal and determines if the description 
  // starts in a read-only or editing state.
  onOpen: (id: string, mode = "view") => {
    console.log(`[useCardModal] Opening card: ${id} in ${mode} mode`); // Senior Debugging
    set({ isOpen: true, id, mode });
  },

  onClose: () => set({ isOpen: false, id: undefined, mode: "view" }),
}));