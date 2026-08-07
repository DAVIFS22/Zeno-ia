import React, { useState, useEffect } from 'react';
import { 
  X, Award, Zap, Flame, Trophy, CheckCircle2, 
  BarChart3, Shield, Star, Clock, Sparkles, Target, Compass 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getUserGamificationProfile, getNextLevelInfo } from '../services/gamificationService';
import { UserGamificationProfile, INITIAL_BADGES, INITIAL_QUESTS } from '../types/gamification';

interface GamificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export const GamificationModal: React.FC<GamificationModalProps> = ({
  isOpen,
  onClose,
  theme = 'dark'
}) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserGamificationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'quests' | 'stats'>('overview');

  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen, user?.uid]);

  const loadProfile = async () => {
    setLoading(true);
    const data = await getUserGamificationProfile(user?.uid || '');
    setProfile(data);
    setLoading(false);
  };

  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const levelInfo = profile ? getNextLevelInfo(profile.totalPoints) : { currentName: 'Iniciante', nextName: 'Explorador', progressPercent: 0, pointsNeeded: 100, currentPoints: 0 };

  const getRarityBadgeStyle = (rarity: string) => {
    switch (rarity) {
      case 'Lendário':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Épico':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'Raro':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      default:
        return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className={`relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all ${
        isDark ? 'bg-[#121214] border-[#2C2C2E] text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900'
      }`}>
        
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${
          isDark ? 'border-[#2C2C2E] bg-[#1A1A1E]' : 'border-neutral-200 bg-neutral-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Centro de Evolução & ZP (ZENO Points)</h2>
              <p className="text-[11px] text-neutral-400">Acompanhe seu progresso, distintivos e missões na Zeno IA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-200 text-neutral-600 hover:text-black'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className={`flex px-6 py-2.5 gap-2 border-b text-xs font-medium ${
          isDark ? 'border-[#2C2C2E] bg-[#161619]' : 'border-neutral-200 bg-neutral-100/50'
        }`}>
          {[
            { id: 'overview', label: 'Visão Geral', icon: Trophy },
            { id: 'badges', label: 'Distintivos', icon: Award },
            { id: 'quests', label: 'Missões', icon: Target },
            { id: 'stats', label: 'Estatísticas', icon: BarChart3 }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : isDark ? 'text-neutral-400 hover:bg-neutral-800 hover:text-white' : 'text-neutral-600 hover:bg-neutral-200 hover:text-black'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center text-xs text-neutral-400">Carregando dados de evolução...</div>
          ) : profile ? (
            <>
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Top Summary Banner */}
                  <div className={`p-5 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
                    isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xl font-bold">
                        ZP
                      </div>
                      <div>
                        <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Pontuação Total</span>
                        <div className="text-2xl font-bold text-white flex items-center gap-2">
                          {profile.totalPoints} <span className="text-xs font-normal text-blue-400">ZP</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-neutral-800 pt-4 md:pt-0 md:pl-6 w-full md:w-auto justify-around">
                      <div className="text-center">
                        <span className="text-[10px] text-neutral-400 uppercase block">Nível Atual</span>
                        <span className="text-xs font-bold text-blue-400">{profile.currentLevel}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] text-neutral-400 uppercase block">Sequência</span>
                        <span className="text-xs font-bold text-amber-400 flex items-center justify-center gap-1">
                          <Flame className="w-3.5 h-3.5 fill-current" /> {profile.currentStreak} dias
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Level Progress Bar */}
                  <div className={`p-4 rounded-2xl border space-y-3 ${
                    isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
                  }`}>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-white">Progresso para o próximo nível</span>
                      <span className="text-neutral-400">{levelInfo.progressPercent}% ({levelInfo.pointsNeeded} ZP restantes)</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-neutral-800 overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                        style={{ width: `${levelInfo.progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-neutral-400 font-mono">
                      <span>Atual: {levelInfo.currentName}</span>
                      <span>Próximo: {levelInfo.nextName}</span>
                    </div>
                  </div>

                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-neutral-900/30 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                      <span className="text-[10px] text-neutral-400 uppercase font-mono">Conversas</span>
                      <p className="text-lg font-bold text-white mt-0.5">{profile.stats.conversationsCount}</p>
                    </div>
                    <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-neutral-900/30 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                      <span className="text-[10px] text-neutral-400 uppercase font-mono">Projetos</span>
                      <p className="text-lg font-bold text-white mt-0.5">{profile.stats.projectsCreated}</p>
                    </div>
                    <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-neutral-900/30 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                      <span className="text-[10px] text-neutral-400 uppercase font-mono">Imagens</span>
                      <p className="text-lg font-bold text-white mt-0.5">{profile.stats.imagesGenerated}</p>
                    </div>
                    <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-neutral-900/30 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                      <span className="text-[10px] text-neutral-400 uppercase font-mono">Pesquisas</span>
                      <p className="text-lg font-bold text-white mt-0.5">{profile.stats.searchesPerformed}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* BADGES TAB */}
              {activeTab === 'badges' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Seus Distintivos ({profile.badges.length} conquistados)</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {INITIAL_BADGES.map((badge) => {
                      const earned = profile.badges.some(b => b.badgeId === badge.id);
                      return (
                        <div 
                          key={badge.id}
                          className={`p-4 rounded-xl border flex items-start gap-3.5 transition-all ${
                            earned 
                              ? isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
                              : isDark ? 'bg-neutral-900/20 border-neutral-900 opacity-50 grayscale' : 'bg-neutral-100 border-neutral-200 opacity-50 grayscale'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                            earned ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                          }`}>
                            <Award className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-xs font-bold text-white truncate">{badge.title}</h4>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full border font-medium ${getRarityBadgeStyle(badge.rarity)}`}>
                                {badge.rarity}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">{badge.description}</p>
                            {earned && (
                              <span className="text-[9px] text-blue-400 font-mono mt-2 block flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Conquistado
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* QUESTS TAB */}
              {activeTab === 'quests' && (
                <div className="space-y-4 animate-fadeIn">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Missões Ativas & Recompensas</h3>

                  <div className="space-y-3">
                    {INITIAL_QUESTS.map((quest) => {
                      const isCompleted = profile.completedQuests.includes(quest.id);
                      return (
                        <div 
                          key={quest.id}
                          className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                            isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-neutral-50 border-neutral-200'
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                              isCompleted ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                            }`}>
                              <Target className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-white">{quest.title}</h4>
                                <span className="text-[9px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">
                                  +{quest.rewardPoints} ZP
                                </span>
                              </div>
                              <p className="text-[11px] text-neutral-400 mt-0.5">{quest.description}</p>
                            </div>
                          </div>

                          <div>
                            {isCompleted ? (
                              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" /> Concluída
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-neutral-400">Em andamento</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STATS TAB */}
              {activeTab === 'stats' && (
                <div className="space-y-4 animate-fadeIn">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Estatísticas Detalhadas de Uso</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className={`p-4 rounded-xl border flex items-center justify-between ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                      <span className="text-xs text-neutral-300">Total de Conversas</span>
                      <span className="text-sm font-bold text-white font-mono">{profile.stats.conversationsCount}</span>
                    </div>
                    <div className={`p-4 rounded-xl border flex items-center justify-between ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                      <span className="text-xs text-neutral-300">Projetos Criados</span>
                      <span className="text-sm font-bold text-white font-mono">{profile.stats.projectsCreated}</span>
                    </div>
                    <div className={`p-4 rounded-xl border flex items-center justify-between ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                      <span className="text-xs text-neutral-300">Imagens Geradas</span>
                      <span className="text-sm font-bold text-white font-mono">{profile.stats.imagesGenerated}</span>
                    </div>
                    <div className={`p-4 rounded-xl border flex items-center justify-between ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                      <span className="text-xs text-neutral-300">Pesquisas na Web</span>
                      <span className="text-sm font-bold text-white font-mono">{profile.stats.searchesPerformed}</span>
                    </div>
                    <div className={`p-4 rounded-xl border flex items-center justify-between ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                      <span className="text-xs text-neutral-300">Blocos de Código Produzidos</span>
                      <span className="text-sm font-bold text-white font-mono">{profile.stats.codeBlocksProduced}</span>
                    </div>
                    <div className={`p-4 rounded-xl border flex items-center justify-between ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                      <span className="text-xs text-neutral-300">Dias Ativos na Plataforma</span>
                      <span className="text-sm font-bold text-white font-mono">{profile.stats.activeDays} dias</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-16 text-center space-y-4 max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Conecte sua conta para ver seu progresso</h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Faça login com o Google para acumular ZP (Zeno Points), progredir de nível, conquistar distintivos e acompanhar suas métricas no ZENO.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-3.5 border-t flex justify-between items-center text-xs ${
          isDark ? 'border-[#2C2C2E] bg-[#161619]' : 'border-neutral-200 bg-neutral-100'
        }`}>
          <span className="text-neutral-400">Zeno IA • Sistema de Gamificação & Evolução ZP</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
