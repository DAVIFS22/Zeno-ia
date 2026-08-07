/**
 * Safe copy to clipboard utility.
 * Handles iframe focus constraints, 'Document is not focused' DOMExceptions,
 * and falls back to traditional document.execCommand('copy') when necessary.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Try standard navigator.clipboard API first
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard.writeText failed or document unfocused, falling back:', err);
    }
  }

  // Fallback using invisible textarea and execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Position fixed off-screen / transparent to avoid scroll shift or visual flash
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (fallbackErr) {
    console.error('[Clipboard] Fallback execCommand copy failed:', fallbackErr);
    return false;
  }
}
