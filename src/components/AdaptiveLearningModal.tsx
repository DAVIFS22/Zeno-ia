import React, { useState } from 'react';
import { 
  X, Brain, Sparkles, Check, Sliders, Shield, BookOpen, 
  MessageSquare, Lightbulb, Zap, Plus, Trash2, ArrowRight,
  Gauge, Award, ThumbsUp, ThumbsDown, Info
} from 'lucide-react';
import { AdaptiveLearningProfile, KnowledgeLevel, CommunicationStyle, TonePreference, ApproachBias } from '../types';
import { DEFAULT_ADAPTIVE_PROFILE, KNOWLEDGE_LEVEL_DESCRIPTIONS } from '../lib/adaptiveLearning';
import { ZenoLogo } from './ZenoLogo';

interface AdaptiveLearningModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: AdaptiveLearningProfile;
  onUpdateProfile: (updated: AdaptiveLearningProfile) => void;
  userId?: string;
  theme?: 'dark' | 'light';
  logoVariant?: 'monochrome' | 'gradient';
}

export function AdaptiveLearningModal({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
  theme = 'dark',
  logoVariant = 'gradient'
}: AdaptiveLearningModalProps) {
  const currentProfile = profile || DEFAULT_ADAPTIVE_PROFILE;
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
  const positiveRatio = totalFeedback > 0 
    ? Math.round(((currentProfile.positiveCount || 0) / totalFeedback) * 100) 
    : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div 
        className={`relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isDark 
            ? 'bg-[#121216] border-[#2C2C2E] text-neutral-100' 
            : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        {/* Header */}
        <div className={`p-5 sm:p-6 border-b flex items-center justify-between ${
          isDark ? 'border-[#2C2C2E]/80 bg-[#1C1C1E]/40' : 'border-neutral-200 bg-neutral-50/50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#232326]/60 border border-[#2C2C2E]/50 flex items-center justify-center">
              <Brain className="w-6 h-6 text-sky-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">Aprendizado Adaptativo ZENO</h2>
                <span className="px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Motor IA
                </span>
              </div>
              <p className={`text-xs sm:text-sm mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                Personalização contínua de complexidade, precisão e estilo de interação.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isDark ? 'hover:bg-[#232326] text-neutral-400 hover:text-white' : 'hover:bg-neutral-200 text-neutral-600 hover:text-black'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className={`px-5 sm:px-6 pt-3 flex gap-2 border-b overflow-x-auto ${
          isDark ? 'border-[#2C2C2E]/80 bg-[#121216]' : 'border-neutral-200 bg-white'
        }`}>
          {[
            { id: 'overview', label: 'Visão Geral', icon: Gauge },
            { id: 'domains', label: 'Nível por Área', icon: BookOpen },
            { id: 'preferences', label: 'Estilo & Tom', icon: Sliders },
            { id: 'insights', label: 'Insights do ZENO', icon: Lightbulb }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                  isActive 
                    ? 'border-sky-400 text-sky-400' 
                    : `border-transparent ${isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'}`
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1C1C1E]/60 border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'}`}>
                  <div className="flex items-center justify-between text-neutral-400 mb-1">
                    <span className="text-xs font-semibold">Nível Global Ativo</span>
                    <Award className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="text-lg font-bold capitalize text-sky-400">
                    {currentProfile.globalKnowledgeLevel}
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    Ajusta abstrações e profundidade técnica.
                  </div>
                </div>

                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1C1C1E]/60 border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'}`}>
                  <div className="flex items-center justify-between text-neutral-400 mb-1">
                    <span className="text-xs font-semibold">Sintonia de Precisão</span>
                    <ThumbsUp className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="text-lg font-bold text-neutral-100">
                    {positiveRatio}% de Precisão
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    Baseado em {totalFeedback} feedbacks registrados.
                  </div>
                </div>

                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1C1C1E]/60 border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'}`}>
                  <div className="flex items-center justify-between text-neutral-400 mb-1">
                    <span className="text-xs font-semibold">Adaptação por IA</span>
                    <Zap className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div className="text-lg font-bold text-neutral-100">
                    {currentProfile.autoAdapt ? 'Ativada' : 'Manual'}
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    ZENO aprende com cada conversa.
                  </div>
                </div>
              </div>

              {/* Global Level Control */}
              <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#1C1C1E]/40 border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-base">Nível Global de Conhecimento</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Define a abordagem padrão do ZENO ao responder perguntas genéricas.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
                  {(['iniciante', 'intermediario', 'avancado', 'especialista'] as KnowledgeLevel[]).map(level => {
                    const isSelected = currentProfile.globalKnowledgeLevel === level;
                    return (
                      <button
                        key={level}
                        onClick={() => handleLevelChange('global', level)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected 
                            ? 'bg-sky-500/10 border-sky-500/50 text-sky-400 ring-1 ring-sky-500/30' 
                            : `${isDark ? 'bg-[#1C1C1E] border-[#2C2C2E] hover:border-[#2C2C2E] text-neutral-300' : 'bg-white border-neutral-200 hover:border-neutral-300 text-neutral-800'}`
                        }`}
                      >
                        <div className="font-bold capitalize text-sm mb-1">{level}</div>
                        <div className="text-[11px] text-neutral-400 line-clamp-2 leading-tight">
                          {KNOWLEDGE_LEVEL_DESCRIPTIONS[level]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto-adaptation Switch */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                isDark ? 'bg-[#1C1C1E]/40 border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Ajuste Automático por IA</div>
                    <div className="text-xs text-neutral-400">
                      Permitir que ZENO refine suas preferências automaticamente ao receber feedbacks nas conversas.
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onUpdateProfile({ ...currentProfile, autoAdapt: !currentProfile.autoAdapt, lastUpdated: Date.now() })}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${
                    currentProfile.autoAdapt ? 'bg-sky-500' : 'bg-neutral-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    currentProfile.autoAdapt ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>
          )}

          {/* TAB: DOMAINS */}
          {activeTab === 'domains' && (
            <div className="space-y-4">
              <div className="text-xs text-neutral-400 mb-2">
                Defina seu nível específico por área de conhecimento para que o ZENO saiba exatamente como calibrar explicações de código, finanças, ciência ou escrita.
              </div>

              {[
                { id: 'programacao', title: 'Programação & Desenvolvimento', desc: 'Sintaxe, frameworks, algoritmos e arquitetura de código.' },
                { id: 'negocios', title: 'Negócios, Estratégia & Finanças', desc: 'Modelos de negócios, análise de mercado e planejamento financeiro.' },
                { id: 'ciencia_tech', title: 'Ciência, Tecnologia & Engenharia', desc: 'Conceitos científicos, física, IA, hardware e dados.' },
                { id: 'historia_geografia', title: 'História Mundial & Geografia', desc: 'Civilizações, eras históricas, mapas, continentes, capitais, relevo e geopolítica.' },
                { id: 'ciencias_naturais', title: 'Ciências Naturais & Fenômenos', desc: 'Física, Química, Biologia, Astronomia e fenômenos da terra e do universo.' },
                { id: 'escrita_criativa', title: 'Escrita, Conteúdo & Criação', desc: 'Copywriting, literatura, tom editorial e roteiros.' },
                { id: 'geral', title: 'Conhecimento Geral & Cotidiano', desc: 'Tópicos diversos do dia a dia, cultura e produtividade.' }
              ].map(domain => {
                const currentVal = (currentProfile.domainLevels as any)?.[domain.id] || 'intermediario';
                return (
                  <div 
                    key={domain.id}
                    className={`p-4 rounded-xl border ${isDark ? 'bg-[#1C1C1E]/50 border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="font-bold text-sm text-neutral-100">{domain.title}</div>
                        <div className="text-xs text-neutral-400">{domain.desc}</div>
                      </div>
                      <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        {currentVal}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {(['iniciante', 'intermediario', 'avancado', 'especialista'] as KnowledgeLevel[]).map(lvl => (
                        <button
                          key={lvl}
                          onClick={() => handleLevelChange(domain.id, lvl)}
                          className={`py-2 px-1 rounded-lg text-xs font-medium text-center border transition-all ${
                            currentVal === lvl 
                              ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-bold' 
                              : `${isDark ? 'bg-[#1C1C1E] border-[#2C2C2E] hover:bg-[#232326] text-neutral-400' : 'bg-white border-neutral-200 hover:bg-neutral-100 text-neutral-600'}`
                          }`}
                        >
                          <span className="capitalize">{lvl}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: PREFERENCES */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              {/* Communication Style */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1C1C1E]/50 border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'}`}>
                <h3 className="font-bold text-sm mb-1">Estilo de Comunicação</h3>
                <p className="text-xs text-neutral-400 mb-3">Como ZENO deve estruturar o volume e formato das explicações.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'conciso', label: 'Conciso', desc: 'Direto ao ponto, respostas curtas e objetivas.' },
                    { id: 'equilibrado', label: 'Equilibrado', desc: 'Ideal entre concisão e clareza explicativa.' },
                    { id: 'detalhado', label: 'Detalhado', desc: 'Passo a passo minucioso com justificativas.' },
                    { id: 'didatico', label: 'Didático', desc: 'Conceitual, usando analogias e exemplos.' }
                  ].map(style => (
                    <button
                      key={style.id}
                      onClick={() => onUpdateProfile({ ...currentProfile, communicationStyle: style.id as CommunicationStyle, lastUpdated: Date.now() })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        currentProfile.communicationStyle === style.id
                          ? 'bg-sky-500/10 border-sky-500/50 text-sky-400 ring-1 ring-sky-500/30'
                          : `${isDark ? 'bg-[#1C1C1E] border-[#2C2C2E] hover:border-[#2C2C2E] text-neutral-300' : 'bg-white border-neutral-200 hover:border-neutral-300 text-neutral-800'}`
                      }`}
                    >
                      <div className="font-bold text-xs mb-1">{style.label}</div>
                      <div className="text-[11px] text-neutral-400">{style.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone Preference */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1C1C1E]/50 border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'}`}>
                <h3 className="font-bold text-sm mb-1">Tom de Voz das Respostas</h3>
                <p className="text-xs text-neutral-400 mb-3">Escolha a personalidade e registro linguístico do ZENO.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'tecnico', label: 'Técnico', desc: 'Rigoroso, preciso e formal.' },
                    { id: 'amigavel', label: 'Amigável', desc: 'Empático e acolhedor.' },
                    { id: 'formal', label: 'Formal', desc: 'Corporativo e executivo.' },
                    { id: 'descontraido', label: 'Descontraído', desc: 'Casual e moderno.' }
                  ].map(tone => (
                    <button
                      key={tone.id}
                      onClick={() => onUpdateProfile({ ...currentProfile, tonePreference: tone.id as TonePreference, lastUpdated: Date.now() })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        currentProfile.tonePreference === tone.id
                          ? 'bg-sky-500/10 border-sky-500/50 text-sky-400 ring-1 ring-sky-500/30'
                          : `${isDark ? 'bg-[#1C1C1E] border-[#2C2C2E] hover:border-[#2C2C2E] text-neutral-300' : 'bg-white border-neutral-200 hover:border-neutral-300 text-neutral-800'}`
                      }`}
                    >
                      <div className="font-bold text-xs mb-1">{tone.label}</div>
                      <div className="text-[11px] text-neutral-400">{tone.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Approach Bias: Precision vs Creativity */}
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1C1C1E]/50 border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'}`}>
                <h3 className="font-bold text-sm mb-1">Viés de Abordagem (Precisão vs Criatividade)</h3>
                <p className="text-xs text-neutral-400 mb-3">Defina se ZENO deve priorizar exatidão técnica rigorosa ou exploração criativa.</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'preciso', label: 'Foco em Precisão', desc: 'Máxima exatidão, sem adivinhações.' },
                    { id: 'equilibrado', label: 'Equilibrado', desc: 'Sintonia entre técnica e criatividade.' },
                    { id: 'criativo', label: 'Foco em Criatividade', desc: 'Explora soluções inovadoras e metáforas.' }
                  ].map(bias => (
                    <button
                      key={bias.id}
                      onClick={() => onUpdateProfile({ ...currentProfile, approachBias: bias.id as ApproachBias, lastUpdated: Date.now() })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        currentProfile.approachBias === bias.id
                          ? 'bg-sky-500/10 border-sky-500/50 text-sky-400 ring-1 ring-sky-500/30'
                          : `${isDark ? 'bg-[#1C1C1E] border-[#2C2C2E] hover:border-[#2C2C2E] text-neutral-300' : 'bg-white border-neutral-200 hover:border-neutral-300 text-neutral-800'}`
                      }`}
                    >
                      <div className="font-bold text-xs mb-1">{bias.label}</div>
                      <div className="text-[11px] text-neutral-400">{bias.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: INSIGHTS */}
          {activeTab === 'insights' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">Insights Aprendidos pelo ZENO</h3>
                  <p className="text-xs text-neutral-400">Preferências e hábitos observados que orientam as respostas personalizadas.</p>
                </div>

                <button
                  onClick={() => setShowAddInsight(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Insight</span>
                </button>
              </div>

              {showAddInsight && (
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1C1C1E] border-[#2C2C2E]' : 'bg-neutral-100 border-neutral-300'}`}>
                  <label className="block text-xs font-bold mb-1.5">Novo Insight Personalizado:</label>
                  <input
                    type="text"
                    value={newInsightText}
                    onChange={(e) => setNewInsightText(e.target.value)}
                    placeholder="Ex: Prefere respostas em TypeScript com comentários explicativos em português."
                    className={`w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-sky-500 mb-3 ${
                      isDark ? 'bg-[#121212] border-[#2C2C2E] text-neutral-100' : 'bg-white border-neutral-300 text-neutral-900'
                    }`}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowAddInsight(false)}
                      className="px-3 py-1.5 text-xs rounded-lg text-neutral-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAddInsight}
                      className="px-3 py-1.5 text-xs font-bold bg-sky-500 text-neutral-950 rounded-lg hover:bg-sky-400"
                    >
                      Salvar Insight
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {(currentProfile.learnedInsights || []).length === 0 ? (
                  <div className={`p-6 rounded-xl border text-center ${isDark ? 'bg-[#1C1C1E]/30 border-[#2C2C2E] text-neutral-500' : 'bg-neutral-50 border-neutral-200 text-neutral-400'}`}>
                    Nenhum insight registrado ainda. Conforme você conversa e avalia o ZENO, os aprendizados aparecerão aqui.
                  </div>
                ) : (
                  currentProfile.learnedInsights.map((insight, idx) => (
                    <div 
                      key={idx}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                        isDark ? 'bg-[#1C1C1E]/60 border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 text-xs leading-relaxed text-neutral-200">
                        <Lightbulb className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                        <span>{insight}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveInsight(idx)}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-400 hover:bg-neutral-500/10 transition-colors"
                        title="Remover insight"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between ${
          isDark ? 'border-[#2C2C2E]/80 bg-[#1C1C1E]/40' : 'border-neutral-200 bg-neutral-50/50'
        }`}>
          <div className="text-xs text-neutral-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-sky-400" />
            <span>Perfil sincronizado e aplicado a cada resposta do ZENO.</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-500 text-neutral-950 hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/10"
          >
            Concluir & Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
