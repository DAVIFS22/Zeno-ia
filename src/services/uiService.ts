import { ModalItemState, ModalId } from '../types/ui';

class UIService {
  private lastFocusedElement: HTMLElement | null = null;
  private scrollLockCount = 0;
  private originalOverflow = '';
  private originalPaddingRight = '';

  /**
   * Save the current active element to restore focus when modals close
   */
  public saveFocus(): void {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      this.lastFocusedElement = document.activeElement;
    }
  }

  /**
   * Restore focus to previously focused element
   */
  public restoreFocus(): void {
    if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
      try {
        this.lastFocusedElement.focus({ preventScroll: true });
      } catch (e) {
        // Ignore focus errors if element was unmounted
      }
      this.lastFocusedElement = null;
    }
  }

  /**
   * Locks body scrolling when a modal or overlay opens
   */
  public lockScroll(): void {
    if (typeof document === 'undefined') return;
    
    if (this.scrollLockCount === 0) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      this.originalOverflow = document.body.style.overflow;
      this.originalPaddingRight = document.body.style.paddingRight;

      document.body.style.overflow = 'hidden';
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }
    }
    this.scrollLockCount++;
  }

  /**
   * Unlocks body scrolling when modals close
   */
  public unlockScroll(): void {
    if (typeof document === 'undefined') return;

    if (this.scrollLockCount > 0) {
      this.scrollLockCount--;
    }

    if (this.scrollLockCount === 0) {
      document.body.style.overflow = this.originalOverflow;
      document.body.style.paddingRight = this.originalPaddingRight;
    }
  }

  /**
   * Force unlock scroll if all modals are closed
   */
  public forceUnlockScroll(): void {
    if (typeof document === 'undefined') return;
    this.scrollLockCount = 0;
    document.body.style.overflow = this.originalOverflow;
    document.body.style.paddingRight = this.originalPaddingRight;
  }

  /**
   * Returns the top active modal by priority or timestamp
   */
  public getTopActiveModal(modals: Record<string, ModalItemState>): ModalItemState | null {
    const activeModals = Object.values(modals).filter(m => m.isOpen);
    if (activeModals.length === 0) return null;

    return activeModals.sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp - a.timestamp;
    })[0];
  }

  /**
   * Helper to attach click outside listener for popups/menus/modals
   */
  public setupClickOutside(
    element: HTMLElement | null,
    onOutsideClick: () => void
  ): () => void {
    if (typeof window === 'undefined' || !element) return () => {};

    const handleClick = (e: MouseEvent) => {
      if (element && !element.contains(e.target as Node)) {
        onOutsideClick();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }

  /**
   * Generates standard ARIA attributes for modals and overlays
   */
  public getAriaAttributes(modalId: ModalId, isOpen: boolean, title?: string) {
    return {
      role: 'dialog',
      'aria-modal': true,
      'aria-hidden': !isOpen,
      'aria-label': title || `${modalId} dialog`,
      id: `modal-${modalId}`
    };
  }
}

export const uiService = new UIService();
