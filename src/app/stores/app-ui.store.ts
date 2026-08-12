import { create } from 'zustand';

export type UtilityPanelTab = 'watcher' | 'scanner' | 'problems' | 'logs';

interface AppUiState {
  activeUtilityTab: UtilityPanelTab;
  isCommandPaletteOpen: boolean;
  isContextSidebarCollapsed: boolean;
  isNavigationCollapsed: boolean;
  isUtilityPanelOpen: boolean;
  setActiveUtilityTab: (tab: UtilityPanelTab) => void;
  setCommandPaletteOpen: (isOpen: boolean) => void;
  setContextSidebarCollapsed: (isCollapsed: boolean) => void;
  setNavigationCollapsed: (isCollapsed: boolean) => void;
  setUtilityPanelOpen: (isOpen: boolean) => void;
  toggleCommandPalette: () => void;
  toggleContextSidebar: () => void;
  toggleNavigation: () => void;
  toggleUtilityPanel: () => void;
}

export const useAppUiStore = create<AppUiState>((set) => ({
  activeUtilityTab: 'watcher',
  isCommandPaletteOpen: false,
  isContextSidebarCollapsed: true,
  isNavigationCollapsed: false,
  isUtilityPanelOpen: false,
  setActiveUtilityTab: (activeUtilityTab) => set({ activeUtilityTab }),
  setCommandPaletteOpen: (isCommandPaletteOpen) =>
    set({ isCommandPaletteOpen }),
  setContextSidebarCollapsed: (isContextSidebarCollapsed) =>
    set({ isContextSidebarCollapsed }),
  setNavigationCollapsed: (isNavigationCollapsed) =>
    set({ isNavigationCollapsed }),
  setUtilityPanelOpen: (isUtilityPanelOpen) => set({ isUtilityPanelOpen }),
  toggleCommandPalette: () =>
    set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
  toggleContextSidebar: () =>
    set((state) => ({
      isContextSidebarCollapsed: !state.isContextSidebarCollapsed,
    })),
  toggleNavigation: () =>
    set((state) => ({ isNavigationCollapsed: !state.isNavigationCollapsed })),
  toggleUtilityPanel: () =>
    set((state) => ({ isUtilityPanelOpen: !state.isUtilityPanelOpen })),
}));
