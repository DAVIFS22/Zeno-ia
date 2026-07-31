import React, { useMemo } from 'react';
import { Globe } from 'lucide-react';
import { SearchSource } from '../types';

interface SourcesCardProps {
  sources: SearchSource[];
  theme: 'light' | 'dark';
  onClick: () => void;
}

// Global cache for favicons and processed metadata during the session
const sourceCache = new Map<string, { domain: string, faviconUrl: string, name: string }>();

export function SourcesCard({ sources, theme, onClick }: SourcesCardProps) {
  if (!sources || sources.length === 0) return null;

  // Memoize domains processing to avoid redundant work
  const processedDomains = useMemo(() => {
    const uniqueDomains = new Set<string>();
    const processed: Array<{ domain: string, faviconUrl: string, name: string }> = [];

    for (const source of sources) {
      try {
        const domain = source.domain || new URL(source.url).hostname.replace(/^www\./, '');
        if (!uniqueDomains.has(domain)) {
          uniqueDomains.add(domain);
          
          if (!sourceCache.has(domain)) {
            let name = domain.split('.')[0];
            // Capitalize properly
            if (name.toLowerCase() === 'g1') name = 'G1';
            else if (name.toLowerCase() === 'wikipedia') name = 'Wikipédia';
            else if (name.toLowerCase() === 'reuters') name = 'Reuters';
            else if (name.toLowerCase() === 'bbc') name = 'BBC';
            else if (name.toLowerCase() === 'cnnbrasil' || name.toLowerCase() === 'cnn') name = 'CNN Brasil';
            else name = name.charAt(0).toUpperCase() + name.slice(1);
            
            sourceCache.set(domain, {
              domain,
              faviconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
              name
            });
          }
          processed.push(sourceCache.get(domain)!);
        }
      } catch (e) {
        // invalid URL handling
      }
    }
    return processed;
  }, [sources]);

  if (processedDomains.length === 0) return null;
  
  const visibleDomains = processedDomains.slice(0, 3);
  const remaining = processedDomains.length - 3;

  return (
    <div className="mt-3.5 pt-3 border-t border-neutral-500/10 flex flex-col gap-1.5 animate-in fade-in duration-300 w-full overflow-hidden">
      <div className={`text-[12px] font-semibold flex items-center gap-1.5 tracking-wide ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
        <span>🌐</span> Fontes
      </div>
      <button 
        onClick={onClick}
        className={`text-left inline-flex flex-wrap items-center gap-1.5 cursor-pointer text-[13px] font-medium transition-colors ${theme === 'dark' ? 'hover:text-neutral-200 text-neutral-300' : 'hover:text-neutral-700 text-neutral-600'}`}
      >
        {visibleDomains.map((meta, idx) => (
          <React.Fragment key={idx}>
            <span className="hover:underline">{meta.name}</span>
            {idx < visibleDomains.length - 1 && <span className="text-neutral-500/40 text-[10px] mx-1">•</span>}
          </React.Fragment>
        ))}
        {remaining > 0 && (
          <>
            <span className="text-neutral-500/40 text-[10px] mx-1">•</span>
            <span className="hover:underline font-semibold">+{remaining}</span>
          </>
        )}
      </button>
    </div>
  );
}
