import { create } from 'zustand';

interface AppUiState {
  isNavigationCollapsed: boolean;
  setNavigationCollapsed: (isCollapsed: boolean) => void;
  toggleNavigation: () => void;
}

export const useAppUiStore = create<AppUiState>((set) => ({
  isNavigationCollapsed: false,
  setNavigationCollapsed: (isNavigationCollapsed) =>
    set({ isNavigationCollapsed }),
  toggleNavigation: () =>
    set((state) => ({ isNavigationCollapsed: !state.isNavigationCollapsed })),
}));
