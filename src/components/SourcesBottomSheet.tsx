import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, X } from 'lucide-react';

interface Source {
  title: string;
  url: string;
  domain?: string;
}

interface SourcesBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sources: Source[];
  theme: string;
}

export function SourcesBottomSheet({ isOpen, onClose, sources, theme }: SourcesBottomSheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const topSources = sources.slice(0, 3);
  const remainingSources = sources.slice(3);

  const getFaviconUrl = (domain: string) => {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose();
              }
            }}
            className={`fixed inset-x-0 bottom-0 z-50 h-[85vh] rounded-t-3xl flex flex-col ${
              theme === 'dark' ? 'bg-[#18181c] text-neutral-200' : 'bg-white text-neutral-800'
            } shadow-2xl`}
          >
            {/* Drag Handle */}
            <div className="flex-shrink-0 w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing">
              <div className={`w-12 h-1.5 rounded-full ${theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-300'}`} />
            </div>

            {/* Header */}
            <div className="flex-shrink-0 flex justify-between items-center px-6 pb-4 pt-2 border-b border-transparent">
              <h2 className="text-xl font-bold">Fontes</h2>
              <button 
                onClick={onClose}
                className={`p-2 rounded-full transition-colors ${
                  theme === 'dark' ? 'hover:bg-[#232326] text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto px-6 pb-12 overscroll-contain">
              <div className="flex flex-col gap-5 mt-2">
                {topSources.map((source, idx) => (
                  <SourceCard key={idx} source={source} theme={theme} getFaviconUrl={getFaviconUrl} />
                ))}

                {remainingSources.length > 0 && (
                  <div className="my-2">
                    <div className="flex items-center gap-4">
                      <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-[#232326]' : 'bg-neutral-200'}`} />
                      <span className={`text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>Mais</span>
                      <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-[#232326]' : 'bg-neutral-200'}`} />
                    </div>
                  </div>
                )}

                {remainingSources.map((source, idx) => (
                  <SourceCard key={`rem-${idx}`} source={source} theme={theme} getFaviconUrl={getFaviconUrl} />
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SourceCard({ source, theme, getFaviconUrl }: { source: Source; theme: string, getFaviconUrl: (d: string) => string }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block py-2 border-b last:border-0 ${theme === 'dark' ? 'border-[#2C2C2E]/60' : 'border-neutral-100'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <img 
          src={getFaviconUrl(source.domain || new URL(source.url).hostname)} 
          alt="" 
          className="w-4 h-4 rounded-sm"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
            if (e.currentTarget.nextElementSibling) {
              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
            }
          }}
        />
        <div className="hidden w-4 h-4 rounded-sm items-center justify-center bg-neutral-500/20">
          <Globe className={`w-3 h-3 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`} />
        </div>
        <span className={`text-[11px] uppercase tracking-wider font-semibold ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
          {source.domain || source.url}
        </span>
      </div>
      <h3 className={`text-base font-semibold mb-1.5 leading-tight group-hover:underline ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}>
        {source.title || source.domain}
      </h3>
      <p className={`text-xs leading-relaxed line-clamp-2 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
        {source.url}
      </p>
    </a>
  );
}
