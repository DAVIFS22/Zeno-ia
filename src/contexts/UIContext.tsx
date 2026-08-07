import React, { createContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  UIContextType, 
  ModalId, 
  ModalOptions, 
  ModalStateMap, 
  ModalItemState 
} from '../types/ui';
import { uiService } from '../services/uiService';

export const UIContext = createContext<UIContextType | null>(null);

interface UIProviderProps {
  children: React.ReactNode;
}

export const UIProvider: React.FC<UIProviderProps> = ({ children }) => {
  // Modal State
  const [modals, setModals] = useState<ModalStateMap>({});
  const [modalHistory, setModalHistory] = useState<ModalId[]>([]);
  const [modalQueue, setModalQueue] = useState<ModalItemState[]>([]);

  // Drawer / Overlay / Menu States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // Active top modal memoized
  const activeModalItem = useMemo(() => {
    return uiService.getTopActiveModal(modals);
  }, [modals]);

  const activeModalId = activeModalItem ? activeModalItem.id : null;

  // Handle scroll lock automatically
  const activeModalCountRef = useRef(0);
  useEffect(() => {
    const activeCount = Object.values(modals).filter(m => m.isOpen && m.preventScroll !== false).length;
    
    if (activeCount > 0 && activeModalCountRef.current === 0) {
      uiService.saveFocus();
      uiService.lockScroll();
    } else if (activeCount === 0 && activeModalCountRef.current > 0) {
      uiService.forceUnlockScroll();
      uiService.restoreFocus();
    }
    
    activeModalCountRef.current = activeCount;
  }, [modals]);

  // Intercept back button (popstate) to close open modals or sidebar smoothly
  useEffect(() => {
    const handlePopState = () => {
      const openModalKeys = Object.keys(modals).filter(k => modals[k]?.isOpen);
      if (openModalKeys.length > 0) {
        const topModal = uiService.getTopActiveModal(modals);
        if (topModal) {
          setModals(prev => ({
            ...prev,
            [topModal.id]: { ...prev[topModal.id], isOpen: false }
          }));
        }
      } else if (isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [modals, isSidebarOpen]);

  // Open Modal
  const openModal = useCallback((id: ModalId, options?: ModalOptions) => {
    const timestamp = Date.now();
    setModals(prev => {
      const next = { ...prev };
      
      if (options?.exclusive) {
        Object.keys(next).forEach(key => {
          if (next[key]?.isOpen) {
            next[key] = { ...next[key], isOpen: false };
          }
        });
      }

      next[id] = {
        id,
        isOpen: true,
        data: options?.data,
        priority: options?.priority ?? 0,
        timestamp,
        preventScroll: options?.preventScroll ?? true,
        onClose: options?.onClose
      };

      return next;
    });

    setModalHistory(prev => [...prev.filter(item => item !== id), id]);
  }, []);

  // Close Modal
  const closeModal = useCallback((id: ModalId) => {
    setModals(prev => {
      if (!prev[id] || !prev[id].isOpen) return prev;
      if (prev[id].onClose) {
        try { prev[id].onClose!(); } catch (e) {}
      }
      return {
        ...prev,
        [id]: { ...prev[id], isOpen: false }
      };
    });
  }, []);

  // Toggle Modal
  const toggleModal = useCallback((id: ModalId, options?: ModalOptions) => {
    setModals(prev => {
      const isCurrentlyOpen = !!prev[id]?.isOpen;
      if (isCurrentlyOpen) {
        if (prev[id].onClose) {
          try { prev[id].onClose!(); } catch (e) {}
        }
        return {
          ...prev,
          [id]: { ...prev[id], isOpen: false }
        };
      } else {
        const timestamp = Date.now();
        const next = { ...prev };
        
        if (options?.exclusive) {
          Object.keys(next).forEach(key => {
            if (next[key]?.isOpen) {
              next[key] = { ...next[key], isOpen: false };
            }
          });
        }

        next[id] = {
          id,
          isOpen: true,
          data: options?.data,
          priority: options?.priority ?? 0,
          timestamp,
          preventScroll: options?.preventScroll ?? true,
          onClose: options?.onClose
        };
        return next;
      }
    });
  }, []);

  // Open Exclusive Modal
  const openExclusiveModal = useCallback((id: ModalId, options?: ModalOptions) => {
    openModal(id, { ...options, exclusive: true });
  }, [openModal]);

  // Close All Modals
  const closeAllModals = useCallback(() => {
    setModals(prev => {
      const hasOpen = Object.values(prev).some(m => m.isOpen);
      if (!hasOpen) return prev;

      const next: ModalStateMap = {};
      Object.keys(prev).forEach(key => {
        if (prev[key]?.onClose && prev[key].isOpen) {
          try { prev[key].onClose!(); } catch (e) {}
        }
        next[key] = { ...prev[key], isOpen: false };
      });
      return next;
    });
  }, []);

  // Enqueue Modal
  const enqueueModal = useCallback((id: ModalId, options?: ModalOptions) => {
    const item: ModalItemState = {
      id,
      isOpen: false,
      data: options?.data,
      priority: options?.priority ?? 0,
      timestamp: Date.now(),
      preventScroll: options?.preventScroll ?? true,
      onClose: options?.onClose
    };

    setModalQueue(prev => [...prev, item].sort((a, b) => (b.priority || 0) - (a.priority || 0)));
  }, []);

  // Process next modal in queue
  const processNextModalInQueue = useCallback(() => {
    setModalQueue(prev => {
      if (prev.length === 0) return prev;
      const [nextModal, ...remaining] = prev;
      openModal(nextModal.id, {
        data: nextModal.data,
        priority: nextModal.priority,
        preventScroll: nextModal.preventScroll,
        onClose: nextModal.onClose
      });
      return remaining;
    });
  }, [openModal]);

  // Check if Modal is Open
  const isModalOpen = useCallback((id: ModalId) => {
    return !!modals[id]?.isOpen;
  }, [modals]);

  // Get Modal Data
  const getModalData = useCallback(<T = any,>(id: ModalId): T | undefined => {
    return modals[id]?.data as T | undefined;
  }, [modals]);

  // Set Modal Data
  const setModalData = useCallback((id: ModalId, data: any) => {
    setModals(prev => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], data }
      };
    });
  }, []);

  // Drawer & Overlay Controls
  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
  const toggleSidebarCollapsed = useCallback(() => setIsSidebarCollapsed(prev => !prev), []);

  const openSearch = useCallback(() => setIsSearchVisible(true), []);
  const closeSearch = useCallback(() => setIsSearchVisible(false), []);
  const toggleSearchVisible = useCallback(() => setIsSearchVisible(prev => !prev), []);

  const openModelDropdown = useCallback(() => setIsModelDropdownOpen(true), []);
  const closeModelDropdown = useCallback(() => setIsModelDropdownOpen(false), []);
  const toggleModelDropdown = useCallback(() => setIsModelDropdownOpen(prev => !prev), []);

  // Specific Modal Shortcuts
  const isSettingsOpen = !!modals['settings']?.isOpen;
  const openSettings = useCallback((data?: any) => openModal('settings', { data }), [openModal]);
  const closeSettings = useCallback(() => closeModal('settings'), [closeModal]);
  const toggleSettings = useCallback(() => toggleModal('settings'), [toggleModal]);

  const isImageStudioOpen = !!modals['imageStudio']?.isOpen;
  const openImageStudio = useCallback((data?: any) => openModal('imageStudio', { data }), [openModal]);
  const closeImageStudio = useCallback(() => closeModal('imageStudio'), [closeModal]);
  const toggleImageStudio = useCallback(() => toggleModal('imageStudio'), [toggleModal]);

  const isImageLibraryOpen = !!modals['imageLibrary']?.isOpen;
  const openImageLibrary = useCallback((data?: any) => openModal('imageLibrary', { data }), [openModal]);
  const closeImageLibrary = useCallback(() => closeModal('imageLibrary'), [closeModal]);
  const toggleImageLibrary = useCallback(() => toggleModal('imageLibrary'), [toggleModal]);

  const isMusicStudioOpen = !!modals['musicStudio']?.isOpen;
  const openMusicStudio = useCallback((data?: any) => openModal('musicStudio', { data }), [openModal]);
  const closeMusicStudio = useCallback(() => closeModal('musicStudio'), [closeModal]);
  const toggleMusicStudio = useCallback(() => toggleModal('musicStudio'), [toggleModal]);

  const isSubscriptionOpen = !!modals['subscription']?.isOpen;
  const openSubscription = useCallback((data?: any) => openModal('subscription', { data }), [openModal]);
  const closeSubscription = useCallback(() => closeModal('subscription'), [closeModal]);
  const toggleSubscription = useCallback(() => toggleModal('subscription'), [toggleModal]);

  const isProFeatureOpen = !!modals['proFeature']?.isOpen;
  const openProFeature = useCallback((data?: any) => openModal('proFeature', { data }), [openModal]);
  const closeProFeature = useCallback(() => closeModal('proFeature'), [closeModal]);
  const toggleProFeature = useCallback(() => toggleModal('proFeature'), [toggleModal]);

  const isProjectsOpen = !!modals['projects']?.isOpen;
  const openProjects = useCallback((data?: any) => openModal('projects', { data }), [openModal]);
  const closeProjects = useCallback(() => closeModal('projects'), [closeModal]);
  const toggleProjects = useCallback(() => toggleModal('projects'), [toggleModal]);

  const isPluginsOpen = !!modals['plugins']?.isOpen;
  const openPlugins = useCallback((data?: any) => openModal('plugins', { data }), [openModal]);
  const closePlugins = useCallback(() => closeModal('plugins'), [closeModal]);
  const togglePlugins = useCallback(() => toggleModal('plugins'), [toggleModal]);

  const isMoreOpen = !!modals['more']?.isOpen;
  const openMore = useCallback((data?: any) => openModal('more', { data }), [openModal]);
  const closeMore = useCallback(() => closeModal('more'), [closeModal]);
  const toggleMore = useCallback(() => toggleModal('more'), [toggleModal]);

  const isProfileOpen = !!modals['profile']?.isOpen;
  const openProfile = useCallback((data?: any) => openModal('profile', { data }), [openModal]);
  const closeProfile = useCallback(() => closeModal('profile'), [closeModal]);
  const toggleProfile = useCallback(() => toggleModal('profile'), [toggleModal]);

  const isNotificationOpen = !!modals['notification']?.isOpen;
  const openNotification = useCallback((data?: any) => openModal('notification', { data }), [openModal]);
  const closeNotification = useCallback(() => closeModal('notification'), [closeModal]);
  const toggleNotification = useCallback(() => toggleModal('notification'), [toggleModal]);

  const isMemoryOpen = !!modals['memory']?.isOpen;
  const openMemory = useCallback((data?: any) => openModal('memory', { data }), [openModal]);
  const closeMemory = useCallback(() => closeModal('memory'), [closeModal]);
  const toggleMemory = useCallback(() => toggleModal('memory'), [toggleModal]);

  const isChatSettingsOpen = !!modals['chatSettings']?.isOpen;
  const openChatSettings = useCallback((data?: any) => openModal('chatSettings', { data }), [openModal]);
  const closeChatSettings = useCallback(() => closeModal('chatSettings'), [closeModal]);
  const toggleChatSettings = useCallback(() => toggleModal('chatSettings'), [toggleModal]);

  const isAccountSwitcherOpen = !!modals['accountSwitcher']?.isOpen;
  const openAccountSwitcher = useCallback((data?: any) => openModal('accountSwitcher', { data }), [openModal]);
  const closeAccountSwitcher = useCallback(() => closeModal('accountSwitcher'), [closeModal]);
  const toggleAccountSwitcher = useCallback(() => toggleModal('accountSwitcher'), [toggleModal]);

  const isDeleteSessionOpen = !!modals['deleteSession']?.isOpen;
  const openDeleteSession = useCallback((data?: any) => openModal('deleteSession', { data }), [openModal]);
  const closeDeleteSession = useCallback(() => closeModal('deleteSession'), [closeModal]);

  const isPythonLearningOpen = !!modals['pythonLearning']?.isOpen;
  const openPythonLearning = useCallback((data?: any) => openModal('pythonLearning', { data }), [openModal]);
  const closePythonLearning = useCallback(() => closeModal('pythonLearning'), [closeModal]);
  const togglePythonLearning = useCallback(() => toggleModal('pythonLearning'), [toggleModal]);

  const isGamificationOpen = !!modals['gamification']?.isOpen;
  const openGamification = useCallback((data?: any) => openModal('gamification', { data }), [openModal]);
  const closeGamification = useCallback(() => closeModal('gamification'), [closeModal]);
  const toggleGamification = useCallback(() => toggleModal('gamification'), [toggleModal]);

  // Global Reset
  const resetUI = useCallback(() => {
    closeAllModals();
    setIsSidebarOpen(false);
    setIsSearchVisible(false);
    setIsModelDropdownOpen(false);
    setModalQueue([]);
  }, [closeAllModals]);

  // ESC key handler for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const topModal = uiService.getTopActiveModal(modals);
        if (topModal) {
          closeModal(topModal.id);
        } else if (isModelDropdownOpen) {
          setIsModelDropdownOpen(false);
        } else if (isSearchVisible) {
          setIsSearchVisible(false);
        } else if (isSidebarOpen) {
          setIsSidebarOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modals, isModelDropdownOpen, isSearchVisible, isSidebarOpen, closeModal]);

  const value = useMemo(() => ({
    modals,
    activeModalId,
    modalHistory,
    modalQueue,

    openModal,
    closeModal,
    toggleModal,
    openExclusiveModal,
    closeAllModals,
    enqueueModal,
    processNextModalInQueue,
    isModalOpen,
    getModalData,
    setModalData,

    isSettingsOpen,
    openSettings,
    closeSettings,
    toggleSettings,

    isMusicStudioOpen,
    openMusicStudio,
    closeMusicStudio,
    toggleMusicStudio,

    isImageStudioOpen,
    openImageStudio,
    closeImageStudio,
    toggleImageStudio,

    isImageLibraryOpen,
    openImageLibrary,
    closeImageLibrary,
    toggleImageLibrary,

    isSubscriptionOpen,
    openSubscription,
    closeSubscription,
    toggleSubscription,

    isProFeatureOpen,
    openProFeature,
    closeProFeature,
    toggleProFeature,

    isProjectsOpen,
    openProjects,
    closeProjects,
    toggleProjects,

    isPluginsOpen,
    openPlugins,
    closePlugins,
    togglePlugins,

    isMoreOpen,
    openMore,
    closeMore,
    toggleMore,

    isProfileOpen,
    openProfile,
    closeProfile,
    toggleProfile,

    isNotificationOpen,
    openNotification,
    closeNotification,
    toggleNotification,

    isMemoryOpen,
    openMemory,
    closeMemory,
    toggleMemory,

    isChatSettingsOpen,
    openChatSettings,
    closeChatSettings,
    toggleChatSettings,

    isAccountSwitcherOpen,
    openAccountSwitcher,
    closeAccountSwitcher,
    toggleAccountSwitcher,

    isDeleteSessionOpen,
    openDeleteSession,
    closeDeleteSession,

    isSidebarOpen,
    isSidebarCollapsed,
    setSidebarOpen: setIsSidebarOpen,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    setSidebarCollapsed: setIsSidebarCollapsed,
    toggleSidebarCollapsed,

    isSearchOpen: isSearchVisible,
    isSearchVisible,
    setSearchVisible: setIsSearchVisible,
    openSearch,
    closeSearch,
    toggleSearchVisible,
    toggleSearch: toggleSearchVisible,

    isModelDropdownOpen,
    setModelDropdownOpen: setIsModelDropdownOpen,
    openModelDropdown,
    closeModelDropdown,
    toggleModelDropdown,

    isPythonLearningOpen,
    openPythonLearning,
    closePythonLearning,
    togglePythonLearning,

    isGamificationOpen,
    openGamification,
    closeGamification,
    toggleGamification,

    resetUI,
  }), [
    modals,
    activeModalId,
    modalHistory,
    modalQueue,
    openModal,
    closeModal,
    toggleModal,
    openExclusiveModal,
    closeAllModals,
    enqueueModal,
    processNextModalInQueue,
    isModalOpen,
    getModalData,
    setModalData,

    isSettingsOpen,
    openSettings,
    closeSettings,
    toggleSettings,

    isMusicStudioOpen,
    openMusicStudio,
    closeMusicStudio,
    toggleMusicStudio,

    isImageStudioOpen,
    openImageStudio,
    closeImageStudio,
    toggleImageStudio,

    isImageLibraryOpen,
    openImageLibrary,
    closeImageLibrary,
    toggleImageLibrary,

    isSubscriptionOpen,
    openSubscription,
    closeSubscription,
    toggleSubscription,

    isProFeatureOpen,
    openProFeature,
    closeProFeature,
    toggleProFeature,

    isProjectsOpen,
    openProjects,
    closeProjects,
    toggleProjects,

    isPluginsOpen,
    openPlugins,
    closePlugins,
    togglePlugins,

    isMoreOpen,
    openMore,
    closeMore,
    toggleMore,

    isProfileOpen,
    openProfile,
    closeProfile,
    toggleProfile,

    isNotificationOpen,
    openNotification,
    closeNotification,
    toggleNotification,

    isMemoryOpen,
    openMemory,
    closeMemory,
    toggleMemory,

    isChatSettingsOpen,
    openChatSettings,
    closeChatSettings,
    toggleChatSettings,

    isAccountSwitcherOpen,
    openAccountSwitcher,
    closeAccountSwitcher,
    toggleAccountSwitcher,

    isDeleteSessionOpen,
    openDeleteSession,
    closeDeleteSession,

    isSidebarOpen,
    isSidebarCollapsed,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    toggleSidebarCollapsed,

    isSearchVisible,
    openSearch,
    closeSearch,
    toggleSearchVisible,

    isModelDropdownOpen,
    openModelDropdown,
    closeModelDropdown,
    toggleModelDropdown,

    isPythonLearningOpen,
    openPythonLearning,
    closePythonLearning,
    togglePythonLearning,

    isGamificationOpen,
    openGamification,
    closeGamification,
    toggleGamification,

    resetUI,
  ]);

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
};
