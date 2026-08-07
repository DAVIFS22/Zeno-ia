import { useTranslation } from '../i18n';
import React, { useState } from 'react';
import { 
  X, Brain, Sparkles, Check, Sliders, Shield, BookOpen, 
  MessageSquare, Lightbulb, Zap, Plus, Trash2, ArrowRight,
  Gauge, Award, ThumbsUp, ThumbsDown, Info, ChevronRight
} from 'lucide-react';
import { AdaptiveLearningProfile, KnowledgeLevel, CommunicationStyle, TonePreference, ApproachBias } from '../types';
import { DEFAULT_ADAPTIVE_PROFILE, KNOWLEDGE_LEVEL_DESCRIPTIONS } from '../lib/adaptiveLearning';
import { motion, AnimatePresence } from 'motion/react';

interface AdaptiveLearningModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: AdaptiveLearningProfile;
  onUpdateProfile: (updated: AdaptiveLearningProfile) => void;
  userId?: string;
  theme?: 'dark' | 'light';
  logoVariant?: 'monochrome' | 'gradient';
}

const LEVEL_LABELS: Record<KnowledgeLevel, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
  especialista: 'Especialista'
};

const SegmentedControl = ({ 
  options, 
  value, 
  onChange, 
  isDark 
}: { 
  options: { id: string; label: string }[]; 
  value: string; 
  onChange: (val: any) => void;
  isDark: boolean;
}) => {
  return (
    <div className={`flex p-1 rounded-xl transition-all ${
      isDark ? 'bg-neutral-900/50 border border-neutral-800' : 'bg-neutral-100 border border-neutral-200'
    }`}>
      {options.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`relative flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all duration-200 z-10 ${
              isActive 
                ? 'text-white' 
                : isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="active-pill"
                className="absolute inset-0 bg-sky-500 rounded-lg -z-10 shadow-sm"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export function AdaptiveLearningModal({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
  theme = 'dark',
}: AdaptiveLearningModalProps) {
  const currentProfile = profile || DEFAULT_ADAPTIVE_PROFILE;
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'domains' | 'preferences' | 'insights'>('overview');
  const [newInsightText, setNewInsightText] = useState('');
  const [showAddInsight, setShowAddInsight] = useState(false);

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  const handleLevelChange = (domain: string, level: KnowledgeLevel) => {
    if (domain === 'global') {
      onUpdateProfile({
        ...currentProfile,
        globalKnowledgeLevel: level,
        lastUpdated: Date.now()
      });
    } else {
      onUpdateProfile({
        ...currentProfile,
        domainLevels: {
          ...currentProfile.domainLevels,
          [domain]: level
        },
        lastUpdated: Date.now()
      });
    }
  };

  const handleAddInsight = () => {
    if (!newInsightText.trim()) return;
    const insights = currentProfile.learnedInsights || [];
    onUpdateProfile({
      ...currentProfile,
      learnedInsights: [newInsightText.trim(), ...insights],
      lastUpdated: Date.now()
    });
    setNewInsightText('');
    setShowAddInsight(false);
  };

  const handleRemoveInsight = (index: number) => {
    const insights = [...(currentProfile.learnedInsights || [])];
    insights.splice(index, 1);
    onUpdateProfile({
      ...currentProfile,
      learnedInsights: insights,
      lastUpdated: Date.now()
    });
  };

  const totalFeedback = currentProfile.feedbackCount || 0;
  const hasEnoughData = totalFeedback >= 5;
  const positiveRatio = totalFeedback > 0 
    ? Math.round(((currentProfile.positiveCount || 0) / totalFeedback) * 100) 
    : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all ${
          isDark 
            ? 'bg-[#0F0F12] border-neutral-800 text-neutral-100' 
            : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        {/* Header */}
        <div className="p-6 flex items-start justify-between">
          <div className="flex gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-neutral-50 border border-neutral-200'
            }`}>
              <Brain className="w-6 h-6 text-sky-500" />
            </div>
            <div className="pt-0.5">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold tracking-tight">{t.adaptiveLearning.title}</h2>
                <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-md bg-sky-500/10 text-sky-500 border border-sky-500/20">
                  ZENO Core
                </span>
              </div>
              <p className={`text-xs max-w-sm leading-relaxed ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                Otimizamos cada resposta com base no seu nível de conhecimento e estilo preferido.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-all ${
              isDark ? 'hover:bg-neutral-900 text-neutral-500 hover:text-white' : 'hover:bg-neutral-100 text-neutral-400 hover:text-black'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 flex gap-6 border-b border-neutral-800/30">
          {[
            { id: 'overview', label: 'Overview', icon: Gauge },
            { id: 'domains', label: 'Domínios', icon: BookOpen },
            { id: 'preferences', label: 'Preferências', icon: Sliders },
            { id: 'insights', label: 'Aprendizado', icon: Lightbulb }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative py-4 text-[13px] font-bold transition-all whitespace-nowrap ${
                  isActive 
                    ? 'text-sky-500' 
                    : isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-800'
                }`}
              >
                {tab.label}
                {isActive && (
                  <motion.div 
                    layoutId="active-tab-border"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 rounded-full" 
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-8 flex-1 scrollbar-hide">
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Nível Ativo', val: LEVEL_LABELS[currentProfile.globalKnowledgeLevel], sub: 'Abordagem Global', icon: Award },
                  { label: 'Precisão', val: hasEnoughData ? `${positiveRatio}%` : '---', sub: `${totalFeedback} interações`, icon: ThumbsUp },
                  { label: 'Modo Adaptativo', val: currentProfile.autoAdapt ? 'Ligado' : 'Desligado', sub: 'Ajustes via IA', icon: Zap }
                ].map((stat, i) => (
                  <div key={i} className={`p-4 rounded-2xl border transition-all hover:scale-[1.02] ${
                    isDark ? 'bg-neutral-900/40 border-neutral-800/50' : 'bg-neutral-50/50 border-neutral-200'
                  }`}>
                    <stat.icon className="w-4 h-4 text-sky-500 mb-3" />
                    <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-0.5">{stat.label}</div>
                    <div className="text-sm font-bold text-neutral-100">{stat.val}</div>
                    <div className="text-[10px] text-neutral-600 mt-0.5">{stat.sub}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold mb-1">{t.adaptiveLearning.globalLevel}</h3>
                  <p className="text-[11px] text-neutral-500">{t.adaptiveLearning.globalLevelDesc}</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['iniciante', 'intermediario', 'avancado', 'especialista'] as KnowledgeLevel[]).map(level => {
                    const isSelected = currentProfile.globalKnowledgeLevel === level;
                    return (
                      <button
                        key={level}
                        onClick={() => handleLevelChange('global', level)}
                        className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                          isSelected 
                            ? 'bg-sky-500/5 border-sky-500/40' 
                            : isDark ? 'bg-neutral-900/20 border-neutral-800/50 hover:border-neutral-700' : 'bg-white border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-bold transition-colors ${isSelected ? 'text-sky-500' : 'text-neutral-300'}`}>
                            {LEVEL_LABELS[level]}
                          </span>
                          {isSelected && <Check className="w-3 h-3 text-sky-500" />}
                        </div>
                        <p className="text-[10px] text-neutral-500 leading-relaxed group-hover:text-neutral-400 transition-colors">
                          {KNOWLEDGE_LEVEL_DESCRIPTIONS[level]}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                isDark ? 'bg-neutral-900/30 border-neutral-800/50' : 'bg-neutral-50/50 border-neutral-200'
              }`}>
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-500">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">{t.adaptiveLearning.continuousLearning}</div>
                    <div className="text-[10px] text-neutral-500">{t.adaptiveLearning.continuousLearningDesc}</div>
                  </div>
                </div>

                <button
                  onClick={() => onUpdateProfile({ ...currentProfile, autoAdapt: !currentProfile.autoAdapt, lastUpdated: Date.now() })}
                  className={`w-11 h-6 rounded-full transition-all relative flex items-center p-1 ${
                    currentProfile.autoAdapt ? 'bg-sky-500' : 'bg-neutral-800'
                  }`}
                >
                  <motion.div 
                    animate={{ x: currentProfile.autoAdapt ? 20 : 0 }}
                    className="w-4 h-4 rounded-full bg-white shadow-sm" 
                  />
                </button>
              </div>
            </div>
          )}

          {/* TAB: DOMAINS */}
          {activeTab === 'domains' && (
            <div className="space-y-4 animate-fadeIn">
              {[
                { id: 'programacao', title: 'Tech & Código', icon: Zap },
                { id: 'negocios', title: 'Business & Finanças', icon: Gauge },
                { id: 'ciencia_tech', title: 'Engenharia & Ciência', icon: Shield },
                { id: 'historia_geografia', title: 'Geopolítica & História', icon: BookOpen },
                { id: 'ciencias_naturais', title: 'Ciências Naturais', icon: Brain },
                { id: 'escrita_criativa', title: 'Redação & Conteúdo', icon: MessageSquare },
                { id: 'geral', title: 'Conhecimento Geral', icon: Sparkles }
              ].map(domain => {
                const currentVal = (currentProfile.domainLevels as any)?.[domain.id] || 'intermediario';
                return (
                  <div 
                    key={domain.id}
                    className="flex items-center justify-between py-3 group border-b border-neutral-800/20 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <domain.icon className="w-4 h-4 text-neutral-600 group-hover:text-sky-500 transition-colors" />
                      <span className="text-xs font-bold text-neutral-300 group-hover:text-neutral-100 transition-colors">{domain.title}</span>
                    </div>

                    <div className="w-64">
                      <SegmentedControl
                        isDark={isDark}
                        value={currentVal}
                        onChange={(val) => handleLevelChange(domain.id, val)}
                        options={[
                          { id: 'iniciante', label: 'I' },
                          { id: 'intermediario', label: 'M' },
                          { id: 'avancado', label: 'A' },
                          { id: 'especialista', label: 'E' }
                        ]}
                      />
                    </div>
                  </div>
                );
              })}
              
              <div className="pt-4 flex justify-center">
                <div className="px-3 py-1.5 rounded-full bg-neutral-900/50 border border-neutral-800 text-[9px] font-bold text-neutral-500 flex items-center gap-2">
                  <span>{t.adaptiveLearning.beginner}</span>
                  <span className="opacity-30">•</span>
                  <span>{t.adaptiveLearning.intermediate}</span>
                  <span className="opacity-30">•</span>
                  <span>{t.adaptiveLearning.advanced}</span>
                  <span className="opacity-30">•</span>
                  <span>{t.adaptiveLearning.expert}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PREFERENCES */}
          {activeTab === 'preferences' && (
            <div className="space-y-8 animate-fadeIn">
              {[
                { 
                  title: 'Extensão das Respostas', 
                  field: 'communicationStyle',
                  options: [
                    { id: 'conciso', label: 'Conciso' },
                    { id: 'equilibrado', label: 'Normal' },
                    { id: 'detalhado', label: 'Longo' },
                    { id: 'didatico', label: 'Tutorial' }
                  ]
                },
                { 
                  title: 'Personalidade do ZENO', 
                  field: 'tonePreference',
                  options: [
                    { id: 'tecnico', label: 'Técnico' },
                    { id: 'amigavel', label: 'Amigável' },
                    { id: 'formal', label: 'Formal' },
                    { id: 'descontraido', label: 'Casual' }
                  ]
                },
                { 
                  title: 'Equilíbrio Criativo', 
                  field: 'approachBias',
                  options: [
                    { id: 'preciso', label: 'Precisão' },
                    { id: 'equilibrado', label: 'Misto' },
                    { id: 'criativo', label: 'Inovação' }
                  ]
                }
              ].map((section, idx) => (
                <div key={idx} className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-neutral-500">{section.title}</h3>
                  <SegmentedControl
                    isDark={isDark}
                    value={(currentProfile as any)[section.field]}
                    onChange={(val) => onUpdateProfile({ ...currentProfile, [section.field]: val, lastUpdated: Date.now() })}
                    options={section.options}
                  />
                </div>
              ))}
            </div>
          )}

          {/* TAB: INSIGHTS */}
          {activeTab === 'insights' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">{t.adaptiveLearning.activeLearnings}</h3>
                  <p className="text-[10px] text-neutral-500">{t.adaptiveLearning.activeLearningsDesc}</p>
                </div>

                <button
                  onClick={() => setShowAddInsight(true)}
                  className="w-8 h-8 rounded-full bg-sky-500 text-neutral-950 flex items-center justify-center hover:scale-110 transition-transform active:scale-95 shadow-lg shadow-sky-500/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <AnimatePresence>
                {showAddInsight && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className={`p-4 rounded-2xl border mb-4 ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                      <input
                        autoFocus
                        type="text"
                        value={newInsightText}
                        onChange={(e) => setNewInsightText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddInsight()}
                        placeholder="Ex: Prefere exemplos em Python..."
                        className={`w-full bg-transparent border-none focus:ring-0 text-xs font-medium placeholder:text-neutral-600 ${
                          isDark ? 'text-neutral-100' : 'text-neutral-900'
                        }`}
                      />
                      <div className="flex justify-end gap-3 mt-3">
                        <button onClick={() => setShowAddInsight(false)} className="text-[10px] font-bold text-neutral-500 hover:text-neutral-300 uppercase tracking-wider">{t.adaptiveLearning.cancel}</button>
                        <button onClick={handleAddInsight} className="text-[10px] font-black text-sky-500 uppercase tracking-widest">{t.adaptiveLearning.save}</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                {(currentProfile.learnedInsights || []).length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center mb-3">
                      <Lightbulb className="w-5 h-5 text-neutral-700" />
                    </div>
                    <p className="text-[11px] text-neutral-600 max-w-[200px]">{t.adaptiveLearning.noInsights}</p>
                  </div>
                ) : (
                  currentProfile.learnedInsights.map((insight, idx) => (
                    <motion.div 
                      layout
                      key={idx}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 group transition-all hover:border-neutral-700 ${
                        isDark ? 'bg-neutral-900/20 border-neutral-800/50' : 'bg-neutral-50 border-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500/50" />
                        <span className="text-[11px] font-medium text-neutral-400 group-hover:text-neutral-200 transition-colors">{insight}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveInsight(idx)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-5 px-6 border-t flex items-center justify-between ${
          isDark ? 'border-neutral-800 bg-[#0F0F12]' : 'border-neutral-200 bg-white'
        }`}>
          <div className="flex items-center gap-2 text-neutral-500">
            <Info className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{t.adaptiveLearning.syncActive}</span>
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-sky-500 text-neutral-950 hover:bg-sky-400 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-sky-500/10"
          >
            Concluir
          </button>
        </div>
      </motion.div>
    </div>
  );
}
