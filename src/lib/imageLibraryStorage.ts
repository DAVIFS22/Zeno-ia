import { GeneratedImage, ImageCollection } from '../types';

const STORAGE_KEY = 'zeno_image_library';
const COLLECTIONS_KEY = 'zeno_image_collections';

export const DEFAULT_COLLECTIONS: ImageCollection[] = [
  { id: 'geral', name: 'Geral', icon: '📁', color: '#3B82F6' },
  { id: 'logos', name: 'Logos & Marcas', icon: '🏷️', color: '#EC4899' },
  { id: 'anime', name: 'Anime & Ilustração', icon: '🎨', color: '#8B5CF6' },
  { id: 'wallpapers', name: 'Wallpapers & Telas', icon: '🖼️', color: '#10B981' },
  { id: 'produtos', name: 'Produtos & Mockups', icon: '📦', color: '#F59E0B' },
  { id: 'personagens', name: 'Personagens & Avatares', icon: '👤', color: '#6366F1' },
  { id: 'projetos', name: 'Projetos', icon: '💼', color: '#14B8A6' },
];

export function getStoredImages(): GeneratedImage[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading image library from localStorage:', e);
  }
  return [];
}

export function saveStoredImages(images: GeneratedImage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
  } catch (e) {
    console.error('Error saving image library to localStorage:', e);
  }
}

export function addImageToLibrary(image: Partial<GeneratedImage> & { imageUrl: string; prompt: string }): GeneratedImage {
  const current = getStoredImages();
  
  // Check if image already exists by URL
  const existing = current.find(i => i.imageUrl === image.imageUrl);
  if (existing) {
    // Update existing metadata if provided
    const updated = current.map(item => {
      if (item.imageUrl === image.imageUrl) {
        return {
          ...item,
          ...image,
          conversationId: image.conversationId || item.conversationId,
          conversationTitle: image.conversationTitle || item.conversationTitle,
        };
      }
      return item;
    });
    saveStoredImages(updated);
    // Sync to backend asynchronously
    syncImageToBackend({ ...existing, ...image });
    return { ...existing, ...image };
  }

  const newImg: GeneratedImage = {
    id: image.id || 'img-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    userId: image.userId || 'user-default',
    conversationId: image.conversationId,
    conversationTitle: image.conversationTitle,
    imageUrl: image.imageUrl,
    thumbnailUrl: image.thumbnailUrl || image.imageUrl,
    prompt: image.prompt,
    originalPrompt: image.originalPrompt || image.prompt,
    optimizedPrompt: image.optimizedPrompt || image.prompt,
    model: image.model || 'Estúdio ZENO Vision',
    provider: image.provider || 'Flux Dev',
    width: image.width || 1024,
    height: image.height || 1024,
    aspectRatio: image.aspectRatio || '1:1',
    style: image.style || 'photorealistic',
    seed: image.seed || Math.floor(Math.random() * 1000000),
    isFavorite: !!image.isFavorite,
    collection: image.collection || 'Geral',
    timestamp: image.timestamp || Date.now(),
  };

  const updatedList = [newImg, ...current];
  saveStoredImages(updatedList);
  syncImageToBackend(newImg);
  return newImg;
}

export function updateImageInLibrary(id: string, updates: Partial<GeneratedImage>): GeneratedImage[] {
  const current = getStoredImages();
  const updatedList = current.map(item => {
    if (item.id === id) {
      const updated = { ...item, ...updates };
      syncImageToBackend(updated);
      return updated;
    }
    return item;
  });
  saveStoredImages(updatedList);
  return updatedList;
}

export function deleteImageFromLibrary(id: string): GeneratedImage[] {
  const current = getStoredImages();
  const updatedList = current.filter(item => item.id !== id);
  saveStoredImages(updatedList);
  
  // Call backend delete
  fetch(`/api/images/${id}`, { method: 'DELETE' }).catch(() => {});
  return updatedList;
}

export function toggleFavoriteInLibrary(id: string): GeneratedImage[] {
  const current = getStoredImages();
  const updatedList = current.map(item => {
    if (item.id === id) {
      const updated = { ...item, isFavorite: !item.isFavorite };
      syncImageToBackend(updated);
      return updated;
    }
    return item;
  });
  saveStoredImages(updatedList);
  return updatedList;
}

export function getStoredCollections(): ImageCollection[] {
  try {
    const saved = localStorage.getItem(COLLECTIONS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error reading collections:', e);
  }
  return DEFAULT_COLLECTIONS;
}

export function addStoredCollection(name: string, icon = '📁', color = '#3B82F6'): ImageCollection[] {
  const collections = getStoredCollections();
  const newCol: ImageCollection = {
    id: 'col-' + Date.now(),
    name: name.trim(),
    icon,
    color
  };
  const updated = [...collections, newCol];
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error(e);
  }
  return updated;
}

// Sync single image to server backend
async function syncImageToBackend(image: GeneratedImage) {
  try {
    await fetch('/api/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(image),
    });
  } catch (e) {
    // Fail silently, local storage works as fallback
  }
}

// Sync whole library from backend on startup
export async function syncLibraryWithBackend(): Promise<GeneratedImage[]> {
  try {
    const res = await fetch('/api/images');
    if (res.ok) {
      const remoteImages = await res.json();
      if (Array.isArray(remoteImages) && remoteImages.length > 0) {
        const localImages = getStoredImages();
        // Merge local & remote by id / imageUrl
        const map = new Map<string, GeneratedImage>();
        localImages.forEach(i => map.set(i.id || i.imageUrl, i));
        remoteImages.forEach(i => map.set(i.id || i.imageUrl, { ...map.get(i.id || i.imageUrl), ...i }));
        const merged = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
        saveStoredImages(merged);
        return merged;
      }
    }
  } catch (e) {
    console.error('Backend sync unavailable:', e);
  }
  return getStoredImages();
}

// Helper to scan markdown text and extract all images automatically
export function scanAndSaveImagesFromText(
  text: string, 
  conversationId?: string, 
  conversationTitle?: string,
  modelName = 'ZENO'
) {
  if (!text) return;
  // Regex to match markdown images: ![alt](https://...)
  const imageRegex = /!\[([^\]]*)\]\((https:\/\/[^\s\)]+)\)/g;
  let match;
  while ((match = imageRegex.exec(text)) !== null) {
    const altText = match[1] || 'Imagem Gerada pelo ZENO';
    const url = match[2];

    if (url.includes('pollinations.ai') || url.includes('image')) {
      addImageToLibrary({
        imageUrl: url,
        prompt: altText,
        originalPrompt: altText,
        conversationId,
        conversationTitle,
        model: modelName,
        provider: 'Flux Dev',
        aspectRatio: '1:1',
        style: 'photorealistic'
      });
    }
  }
}
