import React from 'react';
import { X, Settings, HelpCircle, Shield, Key, Sliders, Database, Volume2, Globe, Cpu, Code, Zap } from 'lucide-react';
import { useTranslation } from '../i18n';

interface MoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenSubscription: () => void;
  onOpenPythonLearning: () => void;
  onOpenGamification: () => void;
}

export const MoreModal: React.FC<MoreModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  onOpenSubscription,
  onOpenPythonLearning,
  onOpenGamification
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="relative w-full max-w-md rounded-2xl bg-[#171717] border border-[#303030] text-white overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#303030] flex items-center justify-between bg-[#171717]">
          <h2 className="text-sm font-semibold text-white">{t.more.title}</h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#242424] text-[#A8A8A8] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links */}
        <div className="p-4 bg-[#0D0D0D] space-y-1.5">
          <button
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-[#171717] hover:bg-[#242424] border border-[#303030] text-xs font-normal text-white transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-4 h-4 text-[#A8A8A8]" />
              <div>
                <span className="font-medium block text-white">{t.more.generalSettings}</span>
                <span className="text-[10px] text-[#A8A8A8]">{t.more.generalSettingsDesc}</span>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenSubscription();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-[#171717] hover:bg-[#242424] border border-[#303030] text-xs font-normal text-white transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Cpu className="w-4 h-4 text-[#A8A8A8]" />
              <div>
                <span className="font-medium block text-white">{t.more.planSubscription}</span>
                <span className="text-[10px] text-[#A8A8A8]">{t.more.planSubscriptionDesc}</span>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-[#171717] hover:bg-[#242424] border border-[#303030] text-xs font-normal text-white transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-[#A8A8A8]" />
              <div>
                <span className="font-medium block text-white">{t.more.privacyData}</span>
                <span className="text-[10px] text-[#A8A8A8]">{t.more.privacyDataDesc}</span>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenPythonLearning();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-[#171717] hover:bg-[#242424] border border-[#303030] text-xs font-normal text-white transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Code className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="font-medium block text-white">Módulo Python Interativo</span>
                <span className="text-[10px] text-[#A8A8A8]">Aprenda programação Python com exemplos e quiz</span>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenGamification();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-[#171717] hover:bg-[#242424] border border-[#303030] text-xs font-normal text-white transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-blue-400" />
              <div>
                <span className="font-medium block text-white">ZENO Points & Gamificação (ZP)</span>
                <span className="text-[10px] text-[#A8A8A8]">Níveis, missões, distintivos e estatísticas</span>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-[#171717] hover:bg-[#242424] border border-[#303030] text-xs font-normal text-white transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="w-4 h-4 text-[#A8A8A8]" />
              <div>
                <span className="font-medium block text-white">{t.more.helpSupport}</span>
                <span className="text-[10px] text-[#A8A8A8]">{t.more.helpSupportDesc}</span>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#303030] bg-[#171717] flex justify-between items-center text-[11px] text-[#A8A8A8]">
          <span>ZENO AI • Minimalist Design</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-[#242424] hover:bg-[#2F2F2F] text-white text-xs border border-[#303030] transition-colors"
          >
            {t.common.close}
          </button>
        </div>

      </div>
    </div>
  );
};
