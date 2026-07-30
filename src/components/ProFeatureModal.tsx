import React from 'react';
import { X, Sparkles, Zap, Shield, Image, Search, FileText } from 'lucide-react';

interface ProFeatureModalProps {
  onClose: () => void;
  onUpgrade: () => void;
  theme?: 'dark' | 'light';
}

export const ProFeatureModal: React.FC<ProFeatureModalProps> = ({ onClose, onUpgrade, theme = 'dark' }) => {
  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className={`relative w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden ${
        isDark ? 'bg-[#1a1a1a] text-white' : 'bg-white text-neutral-900'
      }`}>
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors z-10 ${
            isDark ? 'hover:bg-white/10 text-neutral-400' : 'hover:bg-black/5 text-neutral-500'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-neutral-800 to-neutral-600 flex items-center justify-center shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            <Sparkles className="w-8 h-8 text-white relative z-10" />
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">Recurso exclusivo do ZENO Pro</h2>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                Este recurso está disponível apenas para assinantes do ZENO Pro.
              </p>
            </div>
            
            <div className={`text-sm text-left p-4 rounded-2xl ${isDark ? 'bg-[#242424]' : 'bg-neutral-50'}`}>
              <p className={`font-semibold mb-3 ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
                Faça upgrade para o ZENO Pro e desbloqueie:
              </p>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>Todos os modelos avançados sem limites</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>Prioridade máxima e maior velocidade</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Image className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>Geração de imagens ilimitada</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Search className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>Pesquisas avançadas e análise de arquivos</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>Acesso antecipado aos novos modelos</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="w-full space-y-3">
            <button
              onClick={() => {
                onClose();
                onUpgrade();
              }}
              className="w-full py-4 rounded-2xl font-semibold bg-[#1C1C1E] text-white hover:bg-[#232326] transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Upgrade para o ZENO Pro</span>
            </button>
            
            <button
              onClick={onClose}
              className={`w-full py-4 rounded-2xl font-semibold transition-colors ${
                isDark 
                  ? 'bg-[#232326] text-neutral-300 hover:bg-neutral-700' 
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
