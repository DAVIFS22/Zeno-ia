import React, { useEffect, useState } from 'react';
import { Crown, Clock, ArrowLeft } from 'lucide-react';

interface LimitReachedScreenProps {
  actionType: string;
  onUpgrade: () => void;
  onBack: () => void;
}

export function LimitReachedScreen({ actionType, onUpgrade, onBack }: LimitReachedScreenProps) {
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

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fadeIn">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6">
        <Clock className="w-8 h-8 text-amber-500" />
      </div>
      
      <h2 className="text-2xl font-bold mb-2 text-neutral-900 dark:text-neutral-100">Você atingiu o limite diário deste recurso.</h2>
      <p className="text-neutral-500 dark:text-neutral-400 mb-6 max-w-md text-sm">
        Próxima renovação em:
      </p>

      <div className="flex items-center space-x-3 mb-10 text-neutral-900 dark:text-neutral-100 font-mono text-2xl font-semibold bg-neutral-100 dark:bg-neutral-800/60 px-6 py-4 rounded-2xl border border-neutral-200 dark:border-neutral-700/50 shadow-sm">
        <span>⏳</span>
        <span>{String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}min {String(timeLeft.seconds).padStart(2, '0')}s</span>
      </div>

      <div className="flex flex-col space-y-3 w-full max-w-sm">
        <button
          onClick={onUpgrade}
          className="flex items-center justify-center space-x-2 w-full bg-[#121212] dark:bg-white text-white dark:text-[#121212] px-6 py-3.5 rounded-full font-medium hover:bg-black/80 dark:hover:bg-gray-100 transition-colors"
        >
          <Crown className="w-5 h-5 text-amber-500" />
          <span>Assinar ZENO Pro</span>
        </button>
        
        <button
          onClick={onBack}
          className="flex items-center justify-center space-x-2 w-full bg-gray-100 dark:bg-[#2A2A2A] text-gray-700 dark:text-gray-300 px-6 py-3.5 rounded-full font-medium hover:bg-gray-200 dark:hover:bg-[#333] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para a página inicial</span>
        </button>
      </div>
    </div>
  );
}
