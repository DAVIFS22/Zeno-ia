import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, X, Calendar } from 'lucide-react';
import { SearchSource } from '../types';
import { useTranslation } from '../i18n';

interface SourcesBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sources: SearchSource[];
  theme: string;
}

export function SourcesBottomSheet({ isOpen, onClose, sources, theme }: SourcesBottomSheetProps) {
  const { t } = useTranslation();

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
              <h2 className="text-xl font-bold">{t.sources.title}</h2>
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
                      <span className={`text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>{t.sources.more}</span>
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

function SourceCard({ source, theme, getFaviconUrl }: { source: SearchSource; theme: string, getFaviconUrl: (d: string) => string }) {
  const { t, language } = useTranslation();
  const domain = source.domain || new URL(source.url).hostname;
  
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      
      const localeMap: Record<string, string> = {
        pt: 'pt-BR',
        es: 'es-ES',
        fr: 'fr-FR',
        zh: 'zh-CN'
      };

      return date.toLocaleDateString(localeMap[language] || 'pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };
  
  const pubDateRaw = source.publishedDate || (source as any).publishedAt;
  const upDateRaw = source.updatedDate || (source as any).lastUpdated;

  const pubDate = pubDateRaw ? formatDate(pubDateRaw) : null;
  const upDate = upDateRaw ? formatDate(upDateRaw) : null;

  return (
    <div
      className={`group grid grid-cols-1 gap-3 p-4 rounded-xl border transition-colors ${
        theme === 'dark' 
          ? 'bg-[#1e1e22]/50 border-[#2c2c30] hover:border-[#3a3a40]' 
          : 'bg-neutral-50/70 border-neutral-200/80 hover:border-neutral-300'
      }`}
    >
      {/* Header Row: Domain & Dates */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="grid items-center gap-2.5 min-w-0" style={{ gridTemplateColumns: 'min-content 1fr' }}>
          <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center overflow-hidden">
            <img 
              src={getFaviconUrl(domain)} 
              alt="" 
              className="w-5 h-5 rounded-sm bg-neutral-100 dark:bg-neutral-800 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
                if (e.currentTarget.nextElementSibling) {
                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                }
              }}
            />
            <div className="hidden w-5 h-5 rounded-sm items-center justify-center bg-neutral-500/20">
              <Globe className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`} />
            </div>
          </div>
          <span className={`text-[13px] font-semibold tracking-wide truncate ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`}>
            {domain}
          </span>
        </div>

        {(pubDate || upDate) && (
          <div className={`grid grid-flow-col auto-cols-max items-center gap-x-4 text-[11px] sm:text-[12px] font-medium flex-shrink-0 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {pubDate && (
              <span className="flex items-center gap-1.5" title={t.sources.publishedTitle}>
                <Calendar className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />
                <span>{t.sources.publishedAt.replace('{{date}}', pubDate)}</span>
              </span>
            )}
            {upDate && (
              <span className="flex items-center gap-1.5" title={t.sources.updatedTitle}>
                <Calendar className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />
                <span>{t.sources.updatedAt.replace('{{date}}', upDate)}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Title & URL Description */}
      <div className="space-y-1">
        <h3 className={`text-[15px] sm:text-[16px] font-bold leading-snug ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}>
          {source.title || domain}
        </h3>
        
        <p className={`text-[13px] leading-relaxed line-clamp-2 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>
          {source.url}
        </p>
      </div>

      {/* Footer / Snippet & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-dashed border-neutral-500/20 mt-1">
        <span className={`text-[11px] truncate max-w-full sm:max-w-[65%] ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
          {source.snippet || source.url}
        </span>
        
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all shadow-sm flex-shrink-0 ${
            theme === 'dark' 
              ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100 hover:text-white' 
              : 'bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-200'
          }`}
        >
          {t.sources.accessSource} ↗
        </a>
      </div>
    </div>
  );
}
