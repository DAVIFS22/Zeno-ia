export type ModalId = 
  | 'settings'
  | 'imageStudio'
  | 'imageLibrary'
  | 'musicStudio'
  | 'projects'
  | 'plugins'
  | 'more'
  | 'subscription'
  | 'proFeature'
  | 'deleteSession'
  | 'renewalNotification'
  | 'profile'
  | 'notification'
  | 'memory'
  | 'chatSettings'
  | 'accountSwitcher'
  | 'search'
  | 'sidebar'
  | (string & {});

export interface ModalOptions {
  data?: any;
  exclusive?: boolean;
  priority?: number;
  preventScroll?: boolean;
  onClose?: () => void;
  title?: string;
}

export interface ModalItemState {
  id: ModalId;
  isOpen: boolean;
  data?: any;
  priority?: number;
  timestamp: number;
  preventScroll?: boolean;
  onClose?: () => void;
}

export type ModalStateMap = Record<string, ModalItemState>;

export interface UIContextType {
  // Global Modals State & History & Queue
  modals: ModalStateMap;
  activeModalId: ModalId | null;
  modalHistory: ModalId[];
  modalQueue: ModalItemState[];
  
  // Core Actions
  openModal: (id: ModalId, options?: ModalOptions) => void;
  closeModal: (id: ModalId) => void;
  toggleModal: (id: ModalId, options?: ModalOptions) => void;
  openExclusiveModal: (id: ModalId, options?: ModalOptions) => void;
  closeAllModals: () => void;
  enqueueModal: (id: ModalId, options?: ModalOptions) => void;
  processNextModalInQueue: () => void;
  isModalOpen: (id: ModalId) => boolean;
  getModalData: <T = any>(id: ModalId) => T | undefined;
  setModalData: (id: ModalId, data: any) => void;

  // Specific Modal Convenience Flags & Methods
  isSettingsOpen: boolean;
  openSettings: (data?: any) => void;
  closeSettings: () => void;
  toggleSettings: () => void;

  isImageStudioOpen: boolean;
  openImageStudio: (data?: any) => void;
  closeImageStudio: () => void;
  toggleImageStudio: () => void;

  isImageLibraryOpen: boolean;
  openImageLibrary: (data?: any) => void;
  closeImageLibrary: () => void;
  toggleImageLibrary: () => void;

  isMusicStudioOpen: boolean;
  openMusicStudio: (data?: any) => void;
  closeMusicStudio: () => void;
  toggleMusicStudio: () => void;

  isSubscriptionOpen: boolean;
  openSubscription: (data?: any) => void;
  closeSubscription: () => void;
  toggleSubscription: () => void;

  isProFeatureOpen: boolean;
  openProFeature: (data?: any) => void;
  closeProFeature: () => void;
  toggleProFeature: () => void;

  isProjectsOpen: boolean;
  openProjects: (data?: any) => void;
  closeProjects: () => void;
  toggleProjects: () => void;

  isPluginsOpen: boolean;
  openPlugins: (data?: any) => void;
  closePlugins: () => void;
  togglePlugins: () => void;

  isMoreOpen: boolean;
  openMore: (data?: any) => void;
  closeMore: () => void;
  toggleMore: () => void;

  isProfileOpen: boolean;
  openProfile: (data?: any) => void;
  closeProfile: () => void;
  toggleProfile: () => void;

  isNotificationOpen: boolean;
  openNotification: (data?: any) => void;
  closeNotification: () => void;
  toggleNotification: () => void;

  isMemoryOpen: boolean;
  openMemory: (data?: any) => void;
  closeMemory: () => void;
  toggleMemory: () => void;

  isChatSettingsOpen: boolean;
  openChatSettings: (data?: any) => void;
  closeChatSettings: () => void;
  toggleChatSettings: () => void;

  isAccountSwitcherOpen: boolean;
  openAccountSwitcher: (data?: any) => void;
  closeAccountSwitcher: () => void;
  toggleAccountSwitcher: () => void;

  isDeleteSessionOpen: boolean;
  openDeleteSession: (data?: any) => void;
  closeDeleteSession: () => void;

  // Drawers / Overlays / Menus
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  toggleSidebarCollapsed: () => void;

  isSearchOpen: boolean;
  isSearchVisible: boolean;
  setSearchVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearchVisible: () => void;
  toggleSearch: () => void;

  isModelDropdownOpen: boolean;
  setModelDropdownOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  openModelDropdown: () => void;
  closeModelDropdown: () => void;
  toggleModelDropdown: () => void;

  // Global UI Reset
  resetUI: () => void;
}
