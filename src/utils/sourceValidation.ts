import { SearchSource } from '../types';

export const isValidSource = (source: SearchSource): boolean => {
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

  if (!url) return false;

  try {
    const parsedDomain = new URL(url).hostname.toLowerCase();
    return !invalidPatterns.some(pattern => parsedDomain.includes(pattern) || url.toLowerCase().includes(pattern));
  } catch (e) {
    return false; // Invalid URL
  }
};

export const filterValidSources = (sources: SearchSource[] | undefined): SearchSource[] => {
  if (!sources || !Array.isArray(sources)) return [];
  return sources.filter(source => isValidSource(source));
};

