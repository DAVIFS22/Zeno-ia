import React, { useEffect, useState } from 'react';
import { Award, Shield, Target, Zap } from 'lucide-react';
import { getUserGamificationProfile, getNextLevelInfo } from '../services/gamificationService';
import { UserGamificationProfile, INITIAL_BADGES } from '../types/gamification';

export const UserGamificationSkeleton = ({ isDark }: { isDark: boolean }) => (
  <div className={`mt-6 p-4 rounded-xl border animate-pulse transition-opacity duration-300 ${
    isDark ? 'bg-[#17171a]/90 border-[#2C2C2E]' : 'bg-neutral-50/90 border-neutral-200'
  }`}>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-neutral-300/40 dark:bg-neutral-700/50" />
        <div className="w-28 h-3 rounded bg-neutral-300/40 dark:bg-neutral-700/50" />
      </div>
      <div className="w-20 h-3 rounded bg-neutral-300/40 dark:bg-neutral-700/50" />
    </div>

    <div className="space-y-2 mb-6">
      <div className="flex justify-between">
        <div className="w-16 h-3 rounded bg-neutral-300/40 dark:bg-neutral-700/50" />
        <div className="w-24 h-3 rounded bg-neutral-300/40 dark:bg-neutral-700/50" />
      </div>
      <div className={`w-full h-1.5 rounded-full ${isDark ? 'bg-neutral-800' : 'bg-neutral-200'}`}>
        <div className="w-1/3 h-full rounded-full bg-zeno/30 dark:bg-zeno/30" />
      </div>
    </div>

    <div>
      <div className="w-24 h-2.5 rounded mb-3 bg-neutral-300/40 dark:bg-neutral-700/50" />
      <div className="flex items-center gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i}
            className={`w-8 h-8 rounded-lg border ${
              isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-white/60 border-neutral-200'
            }`}
          />
        ))}
      </div>
    </div>
  </div>
);

export const UserGamificationSnippet = ({ userId, isDark }: { userId: string, isDark: boolean }) => {
  const [profile, setProfile] = useState<UserGamificationProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId && !userId.startsWith('anon_') && userId !== 'anonymous' && userId !== 'local_user') {
      getUserGamificationProfile(userId).then(p => {
        setProfile(p);
        setLoading(false);
      });
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [userId]);

  if (loading) {
    return <UserGamificationSkeleton isDark={isDark} />;
  }
  if (!profile) return null;

  const levelInfo = getNextLevelInfo(profile.totalPoints);
  const earnedBadges = profile.badges.map(b => b.badgeId);
  const topBadges = INITIAL_BADGES.filter(b => earnedBadges.includes(b.id)).slice(0, 4);

  return (
    <div className={`mt-6 p-4 rounded-xl border ${isDark ? 'bg-[#17171a] border-[#2C2C2E]' : 'bg-neutral-50 border-neutral-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-zeno" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Progresso ZENO</h4>
        </div>
        <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-neutral-800'}`}>
          Nível: <span className="text-zeno dark:text-zeno">{profile.currentLevel}</span>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <div className="flex justify-between text-[11px]">
          <span className={`font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>{profile.totalPoints} ZP</span>
          <span className="text-neutral-400">{levelInfo.progressPercent}% para {levelInfo.nextName}</span>
        </div>
        <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-neutral-200'}`}>
          <div 
            className="h-full bg-zeno rounded-full transition-all duration-500" 
            style={{ width: `${levelInfo.progressPercent}%` }}
          />
        </div>
      </div>

      {topBadges.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-3">Distintivos Recentes</h4>
          <div className="flex items-center gap-3">
            {topBadges.map((badge) => (
              <div 
                key={badge.id}
                title={badge.title}
                className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                  isDark ? 'bg-neutral-900 border-neutral-700 text-neutral-400' : 'bg-white border-neutral-200 text-neutral-600'
                }`}
              >
                <Award className="w-4 h-4" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
