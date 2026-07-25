import React, { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';

interface PlanUsageCardProps {
  plan: 'ZENO Free' | 'ZENO Pro';
  limits: any;
  usage: any;
  onClose: () => void;
  onUpgrade: () => void;
}

export function PlanUsageCard({ plan, limits, usage, onClose, onUpgrade }: PlanUsageCardProps) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calcTime = () => {
      const now = new Date();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const diff = endOfDay.getTime() - now.getTime();
      if (diff <= 0) {
        window.location.reload();
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ hours, minutes, seconds });
    };
    calcTime();
    const interval = setInterval(calcTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (plan === 'ZENO Pro') return null;
  if (!limits || !usage) return null;

  const messagesLimit = limits.messages || 50;
  const messagesUsed = usage.messages || 0;
  const messagesLeft = Math.max(0, messagesLimit - messagesUsed);

  // Only display when close to limit (10, 5, or 1 usage remaining)
  if (messagesLeft > 10 || messagesLeft <= 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 mb-4 animate-fadeIn">
      <div className="relative bg-amber-50/90 dark:bg-amber-950/30 rounded-2xl p-4 sm:p-5 border border-amber-200/80 dark:border-amber-900/50 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-amber-700/60 dark:text-amber-400/60 hover:text-amber-900 dark:hover:text-amber-200 rounded-full hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="flex-1 pr-6">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">Aviso de Limite Diário</span>
          </div>
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Restam apenas <strong>{messagesLeft} mensage{messagesLeft === 1 ? 'm' : 'ns'}</strong> hoje. 
            Renovação em ⏳ {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}min {String(timeLeft.seconds).padStart(2, '0')}s.
          </p>
        </div>
        
        <button
          onClick={onUpgrade}
          className="shrink-0 flex items-center space-x-1.5 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-colors w-full sm:w-auto justify-center"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Fazer Upgrade Pro</span>
        </button>
      </div>
    </div>
  );
}
