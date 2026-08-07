import { SearchSource } from '../types';

export const isValidSource = (source: any): boolean => {
  if (!source) return false;
  
  const url = source.url;
  const domain = source.domain;
  
  const invalidPatterns = [
    'pollinations.ai',
    'image.pollinations.ai',
    'midjourney.com',
    'openai.com/dall-e',
    'stability.ai'
  ];

  if (domain && invalidPatterns.some(pattern => domain.toLowerCase().includes(pattern))) {
    return false;
  }

  if (!url || typeof url !== 'string') return false;
  
  // Guarantee that source URLs are not constructed from search queries
  // and are real destination URLs from grounding chunks (API mandated)
  if (url.includes('google.com/search') || url.includes('bing.com/search') || url.includes('duckduckgo.com/?q=')) {
    return false;
  }

  try {
    const parsedDomain = new URL(url).hostname.toLowerCase();
    return !invalidPatterns.some(pattern => parsedDomain.includes(pattern) || url.toLowerCase().includes(pattern));
  } catch (e) {
    return false; // Invalid URL
  }
};

export const filterValidSources = (sources: any[] | undefined): SearchSource[] => {
  if (!sources || !Array.isArray(sources)) return [];
  return sources.filter(source => isValidSource(source));
};

