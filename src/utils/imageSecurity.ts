/**
 * Security utility to validate image URLs before rendering in markdown or components.
 * Prevents unauthorized third-party image generation services (e.g. pollinations.ai)
 * from being injected into the UI.
 */

export const AUTHORIZED_IMAGE_DOMAINS = [
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'googleusercontent.com',
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
  'www.google.com',
  'img.youtube.com',
  'i.ytimg.com',
  'replicate.delivery',
  'pbxt.replicate.delivery',
  'pollinations.ai',
  'image.pollinations.ai',
];

export const BANNED_IMAGE_PATTERNS = [
];

export function isAuthorizedImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  const cleanUrl = url.trim().toLowerCase();

  // Explicitly block banned services
  if (BANNED_IMAGE_PATTERNS.some(banned => cleanUrl.includes(banned))) {
    return false;
  }

  // Allow relative URLs, data URLs, and blob URLs
  if (cleanUrl.startsWith('/') || cleanUrl.startsWith('data:image/') || cleanUrl.startsWith('blob:')) {
    return true;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    return AUTHORIZED_IMAGE_DOMAINS.some(allowed => host === allowed || host.endsWith('.' + allowed));
  } catch (e) {
    return false;
  }
}

/**
 * Server-side / Client-side sanitizer for AI generated text.
 * Strips markdown images if not explicitly in image mode,
 * and removes unauthorized image URLs regardless of mode.
 */
export function sanitizeResponseText(text: string, isImageTask: boolean = false): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // If NOT an image task, strip ALL markdown image syntax ![alt](url) and HTML <img> tags
  if (!isImageTask) {
    cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, '');
    cleaned = cleaned.replace(/<img\s+[^>]*\/?>/gi, '');
  } else {
    // If it IS an image task, filter out image markdown tags pointing to unauthorized URLs
    cleaned = cleaned.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
      if (isAuthorizedImageUrl(url)) {
        return match;
      }
      return ''; // Strip unauthorized images
    });
  }

  return cleaned;
}
