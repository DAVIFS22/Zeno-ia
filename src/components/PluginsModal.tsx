import React, { useState } from 'react';
import { X, Cpu, Globe, Code, FileText, Check, Sparkles, Image as ImageIcon, Search } from 'lucide-react';

interface PluginItem {
  id: string;
  name: string;
  description: string;
  icon: any;
  enabled: boolean;
  category: string;
}

interface PluginsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PluginsModal: React.FC<PluginsModalProps> = ({ isOpen, onClose }) => {
  const [plugins, setPlugins] = useState<PluginItem[]>([
    {
      id: 'web_search',
      name: 'Pesquisa Web em Tempo Real',
      description: 'ZENO Search com Grounding, links, fontes e citações diretas',
      icon: Globe,
      enabled: true,
      category: 'Busca & Dados'
    },
    {
      id: 'code_runner',
      name: 'Compilador & Executor ZENO Código',
      description: 'Suporte a React, TypeScript, Python e Node com visualização',
      icon: Code,
      enabled: true,
      category: 'Programação'
    },
    {
      id: 'image_gen',
      name: 'Estúdio ZENO Vision',
      description: 'Geração, variação, edição e upscale de imagens em alta resolução',
      icon: ImageIcon,
      enabled: true,
      category: 'Imagem'
    },
    {
      id: 'doc_analyzer',
      name: 'Analisador de Documentos PDF/Código',
      description: 'Extração automática, OCR e síntese de arquivos grandes',
      icon: FileText,
      enabled: true,
      category: 'Documentos'
    },
    {
      id: 'reasoning_engine',
      name: 'Motor ZENO Pense (Raciocínio Avançado)',
      description: 'Cadeias de pensamento detalhadas para matemática e lógica',
      icon: Cpu,
      enabled: true,
      category: 'Raciocínio'
    }
  ]);

  if (!isOpen) return null;

  const togglePlugin = (id: string) => {
    setPlugins(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#171717] border border-[#303030] text-white overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#303030] flex items-center justify-between bg-[#171717]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#242424] text-white">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Plugins & Extensões</h2>
              <p className="text-xs text-[#A8A8A8]">Ferramentas ativas para ampliar o ZENO AI</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#242424] text-[#A8A8A8] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Plugin List */}
        <div className="p-5 overflow-y-auto space-y-3 bg-[#0D0D0D] flex-1 scrollbar-custom">
          {plugins.map(p => {
            const Icon = p.icon;
            return (
              <div
                key={p.id}
                className="p-3.5 rounded-xl border border-[#303030] bg-[#171717] flex items-center justify-between gap-3 hover:bg-[#242424] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#242424] text-white mt-0.5">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{p.name}</span>
                      <span className="text-[10px] text-[#A8A8A8] font-mono">{p.category}</span>
                    </div>
                    <p className="text-[11px] text-[#A8A8A8] mt-0.5">{p.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => togglePlugin(p.id)}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out flex items-center flex-shrink-0 ${
                    p.enabled ? 'bg-white justify-end' : 'bg-[#303030] justify-start'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full transition-all ${p.enabled ? 'bg-[#171717]' : 'bg-[#A8A8A8]'}`} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#303030] bg-[#171717] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#242424] hover:bg-[#2F2F2F] text-white text-xs font-medium border border-[#303030] transition-colors"
          >
            Concluído
          </button>
        </div>

      </div>
    </div>
  );
};
