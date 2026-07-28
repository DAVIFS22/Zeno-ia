import { useContext, useMemo } from 'react';
import { UIContext } from '../contexts/UIContext';
import { UIContextType, ModalId, ModalOptions } from '../types/ui';

/**
 * Main hook to access UI state and controls
 */
export const useUIState = (): UIContextType => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUIState must be used within a UIProvider');
  }
  return context;
};

/**
 * Selector-based sub-hook to extract specific slices of UI state
 */
export function useUISelector<T>(selector: (ui: UIContextType) => T): T {
  const ui = useUIState();
  return selector(ui);
}

/**
 * Convenient sub-hook for a specific modal by ID
 */
export function useModal<T = any>(modalId: ModalId) {
  const ui = useUIState();
  const isOpen = ui.isModalOpen(modalId);
  const data = ui.getModalData<T>(modalId);

  const open = (options?: Omit<ModalOptions, 'data'> & { data?: T }) => ui.openModal(modalId, options);
  const close = () => ui.closeModal(modalId);
  const toggle = (options?: Omit<ModalOptions, 'data'> & { data?: T }) => ui.toggleModal(modalId, options);
  const setData = (newData: T) => ui.setModalData(modalId, newData);

  return useMemo(() => ({
    isOpen,
    data,
    open,
    close,
    toggle,
    setData,
  }), [isOpen, data, ui]);
}

/**
 * Dedicated sub-hooks for specific UI modules to avoid prop drilling and unnecessary re-renders
 */
export function useSettingsUI() {
  const ui = useUIState();
  return {
    isOpen: ui.isSettingsOpen,
    open: ui.openSettings,
    close: ui.closeSettings,
    toggle: ui.toggleSettings,
  };
}

export function useSidebarUI() {
  const ui = useUIState();
  return {
    isOpen: ui.isSidebarOpen,
    isCollapsed: ui.isSidebarCollapsed,
    open: ui.openSidebar,
    close: ui.closeSidebar,
    toggle: ui.toggleSidebar,
    setOpen: ui.setSidebarOpen,
    toggleCollapsed: ui.toggleSidebarCollapsed,
    setCollapsed: ui.setSidebarCollapsed,
  };
}

export function useSearchUI() {
  const ui = useUIState();
  return {
    isOpen: ui.isSearchOpen,
    open: ui.openSearch,
    close: ui.closeSearch,
    toggle: ui.toggleSearch,
    setVisible: ui.setSearchVisible,
  };
}

export function useSubscriptionUI() {
  const ui = useUIState();
  return {
    isOpen: ui.isSubscriptionOpen,
    open: ui.openSubscription,
    close: ui.closeSubscription,
    toggle: ui.toggleSubscription,
  };
}

export function useImageStudioUI() {
  const ui = useUIState();
  return {
    isOpen: ui.isImageStudioOpen,
    open: ui.openImageStudio,
    close: ui.closeImageStudio,
    toggle: ui.toggleImageStudio,
  };
}

export function useMusicStudioUI() {
  const ui = useUIState();
  return {
    isOpen: ui.isMusicStudioOpen,
    open: ui.openMusicStudio,
    close: ui.closeMusicStudio,
    toggle: ui.toggleMusicStudio,
  };
}
