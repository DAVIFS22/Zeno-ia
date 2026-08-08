import React, { useState, useEffect } from 'react';
import { History, X, ChevronRight, Loader2 } from 'lucide-react';
import { useVersion } from '../contexts/VersionContext';
import { motion, AnimatePresence } from 'motion/react';

interface VersionNewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  initialVersion?: string;
}

export const VersionNewsModal: React.FC<VersionNewsModalProps> = ({
  isOpen,
  onClose,
  initialVersion
}) => {
  const { versionHistory, markSeen, latestVersion } = useVersion();
  const [selectedVersion, setSelectedVersion] = useState<string>(
    initialVersion || latestVersion.version
  );
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [isReady, setIsReady] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Simulate content ready after a small delay to allow animations to breathe
      const readyTimer = setTimeout(() => {
        setIsReady(true);
      }, 150);
      
      // If after 300ms it's still not ready (simulated or real), show spinner
      const spinnerTimer = setTimeout(() => {
        // We use the functional update to check the CURRENT value of isReady
        setIsReady(currentReady => {
          if (!currentReady) setShowSpinner(true);
          return currentReady;
        });
      }, 300);

      return () => {
        clearTimeout(readyTimer);
        clearTimeout(spinnerTimer);
      };
    } else {
      // Reset states when closing
      setIsReady(false);
      setShowSpinner(false);
    }
  }, [isOpen]);

  const currentEntry = versionHistory.find(v => v.version === selectedVersion) || latestVersion;

  const handleClose = () => {
    markSeen(latestVersion.version);
    onClose();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  const novidadesList = currentEntry.changes?.novidades || currentEntry.novidades || currentEntry.news || [];
  const correcoesList = currentEntry.changes?.correcoes || currentEntry.correcoes || currentEntry.fixes || [];
  const desempenhoList = currentEntry.changes?.desempenho || currentEntry.desempenho || currentEntry.performance || [];
  const arquiteturaList = currentEntry.changes?.arquitetura || currentEntry.arquitetura || currentEntry.architecture || [];

  return (
    <AnimatePresence>
      {isOpen && currentEntry && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-xl max-h-[88vh] flex flex-col bg-[#111111] text-white rounded-2xl shadow-2xl overflow-hidden border border-neutral-800/80"
          >
            
            {/* Header */}
        <div className="flex items-start justify-between px-10 pt-10 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-white">Zeno IA</h2>
              <span className="text-sm font-medium text-neutral-400">v{currentEntry.version}</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-white text-black tracking-wide">
                {currentEntry.type}
              </span>
            </div>
            {currentEntry.date && (
              <p className="text-xs text-neutral-400 font-light">Atualizado em {formatDate(currentEntry.date)}</p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-700 transition-all"
              title="Histórico de Versões"
            >
              <History className="w-3.5 h-3.5" />
              <span>{showHistory ? 'Atual' : 'Histórico'}</span>
            </button>
            <button
              onClick={handleClose}
              className="text-neutral-400 hover:text-white transition-colors p-1"
              title="Fechar"
            >
              <X className="w-5 h-5 font-light" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-10 py-2 space-y-10 min-h-[300px] flex flex-col relative">
          {!isReady ? (
            <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 ${showSpinner ? 'opacity-100' : 'opacity-0'}`}>
              <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
              <p className="text-[10px] font-medium tracking-widest uppercase text-neutral-600 mt-4">Sincronizando</p>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="space-y-10 pb-8"
            >
              {showHistory ? (
                <div className="space-y-4 py-2">
                  <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500 mb-4">Histórico de Versões</h3>
                  <div className="space-y-2">
                    {versionHistory.map((ver) => (
                      <div
                        key={ver.version}
                        onClick={() => {
                          setSelectedVersion(ver.version);
                          setShowHistory(false);
                        }}
                        className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all bg-[#161618] hover:bg-[#1c1c20] ${
                          selectedVersion === ver.version ? 'border border-neutral-700' : 'border border-transparent'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-medium text-sm text-white">v{ver.version}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">
                              {ver.type}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 mt-1">{formatDate(ver.date)}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-500" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-8 py-2">
                  {/* Novidades */}
                  {novidadesList.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500">Novidades</h3>
                      <ul className="space-y-2.5 text-neutral-300 text-sm font-light">
                        {novidadesList.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="text-white select-none mt-0.5">•</span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Correções */}
                  {correcoesList.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500">Correções</h3>
                      <ul className="space-y-2.5 text-neutral-300 text-sm font-light">
                        {correcoesList.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="text-white select-none mt-0.5">•</span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Desempenho */}
                  {desempenhoList.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500">Desempenho</h3>
                      <ul className="space-y-2.5 text-neutral-300 text-sm font-light">
                        {desempenhoList.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="text-white select-none mt-0.5">•</span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Arquitetura */}
                  {arquiteturaList.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500">Arquitetura</h3>
                      <ul className="space-y-2.5 text-neutral-300 text-sm font-light">
                        {arquiteturaList.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="text-white select-none mt-0.5">•</span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {novidadesList.length === 0 && correcoesList.length === 0 && desempenhoList.length === 0 && arquiteturaList.length === 0 && (
                    <p className="text-neutral-400 text-sm">Nenhum detalhe registrado para esta versão.</p>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="px-10 py-6 flex items-center justify-between border-t border-neutral-800/60 mt-auto bg-[#111111]">
          <div>
            <p className="text-xs font-medium text-neutral-300">Semantic Versioning</p>
            <p className="text-[11px] font-mono text-neutral-500">v{currentEntry.version}</p>
          </div>
          <motion.button
            onClick={handleClose}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-2.5 rounded-full bg-white text-black font-medium text-xs shadow-md"
          >
            Continuar
          </motion.button>
        </div>

      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
};
