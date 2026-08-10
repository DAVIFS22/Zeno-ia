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

export function getUniqueSources(sources: SearchSource[]): SearchSource[] {
  if (!sources || sources.length === 0) return [];
  const seen = new Set();
  return sources.filter(s => {
    // Validar se é uma fonte real (deve ter URL e idealmente título)
    if (!s.url || typeof s.url !== 'string' || s.url.trim() === '') return false;
    
    const id = s.url.toLowerCase().trim();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function SourcesCard({ sources, theme, onClick }: SourcesCardProps) {
  const uniqueSources = useMemo(() => getUniqueSources(sources), [sources]);

  if (uniqueSources.length === 0) return null;

  return (
    <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500 w-full">
      <div className={`text-[15px] font-medium mb-4 px-1 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
        {uniqueSources.length} {uniqueSources.length === 1 ? 'fonte' : 'fontes'}
      </div>

      <div className="flex flex-col gap-0">
        {uniqueSources.map((source, idx) => {
          const domain = source.domain || (() => { try { return new URL(source.url).hostname.replace(/^www\./, ''); } catch(e) { return 'web'; } })();
          const name = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
          
          return (
            <React.Fragment key={idx}>
              <a 
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex flex-col gap-1 py-4 px-1 transition-all group border-b border-neutral-500/10 last:border-0`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 flex items-center justify-center rounded-full bg-white overflow-hidden p-0.5 border border-neutral-200">
                    <img 
                      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                      alt=""
                      className="w-full h-full object-contain"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                  <span className={`text-[13px] font-medium truncate ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    {name}
                  </span>
                </div>
                <h4 className={`text-[17px] font-bold leading-tight transition-colors ${
                  theme === 'dark' ? 'text-neutral-100 group-hover:text-zeno' : 'text-neutral-900 group-hover:text-zeno'
                }`}>
                  {source.title}
                </h4>
              </a>
            </React.Fragment>
          );
        })}
      </div>
      
      <button 
        onClick={onClick}
        className={`mt-4 w-full py-3 rounded-xl border text-[13px] font-semibold transition-all ${
          theme === 'dark' 
          ? 'border-neutral-800 text-neutral-400 hover:bg-neutral-800' 
          : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'
        }`}
      >
        Ver todas as fontes detalhadas
      </button>
    </div>
  );
}
