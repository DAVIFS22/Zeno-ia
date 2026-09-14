import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, MessageSquare, Send, X, CheckCircle2 } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface DetailedFeedbackFormProps {
  messageId: string;
  chatId: string;
  onClose: () => void;
  theme: 'light' | 'dark';
}

const DetailedFeedbackForm: React.FC<DetailedFeedbackFormProps> = ({ messageId, chatId, onClose, theme }) => {
  const [utility, setUtility] = useState(0);
  const [clarity, setClarity] = useState(0);
  const [creativity, setCreativity] = useState(0);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (utility === 0 || clarity === 0 || creativity === 0) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: auth.currentUser?.uid || 'anonymous',
        messageId,
        chatId,
        utility,
        clarity,
        creativity,
        comments,
        timestamp: new Date().toISOString()
      });
      setIsSubmitted(true);
      setTimeout(onClose, 2000);
    } catch (error) {
      console.error('Error saving feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const RatingField = ({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) => (
    <div className="flex flex-col gap-2">
      <span className={`text-xs font-medium ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>{label}</span>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onChange(star)}
            className={`p-1 transition-all active:scale-95 ${
              value >= star ? 'text-zeno scale-110' : (theme === 'dark' ? 'text-neutral-700 hover:text-neutral-600' : 'text-neutral-300 hover:text-neutral-400')
            }`}
          >
            <Star className="w-5 h-5 fill-current" strokeWidth={1.5} />
          </button>
        ))}
      </div>
    </div>
  );

  if (isSubmitted) {
    return (
      <div className={`p-6 rounded-2xl border text-center flex flex-col items-center gap-3 animate-in zoom-in-95 duration-300 ${
        theme === 'dark' ? 'bg-[#1C1C1E] border-neutral-800' : 'bg-white border-neutral-200'
      }`}>
        <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <div>
          <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>Feedback enviado!</h3>
          <p className="text-xs text-neutral-500">Obrigado por ajudar a melhorar o ZENO.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-5 rounded-2xl border shadow-2xl w-[320px] max-w-[90vw] animate-in slide-in-from-bottom-4 duration-300 ${
      theme === 'dark' ? 'bg-[#1C1C1E] border-neutral-800' : 'bg-white border-neutral-200'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>Avaliar Resposta</h3>
        <button onClick={onClose} className="p-1 hover:bg-neutral-500/10 rounded-full transition-colors">
          <X className="w-4 h-4 text-neutral-500" />
        </button>
      </div>

      <div className="space-y-4">
        <RatingField label="Utilidade" value={utility} onChange={setUtility} />
        <RatingField label="Clareza" value={clarity} onChange={setClarity} />
        <RatingField label="Criatividade" value={creativity} onChange={setCreativity} />

        <div className="flex flex-col gap-2">
          <span className={`text-xs font-medium ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>Comentários Adicionais</span>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="O que poderia ser melhor?"
            className={`w-full p-3 rounded-xl border text-xs resize-none focus:outline-none focus:ring-1 focus:ring-zeno transition-all ${
              theme === 'dark' 
                ? 'bg-[#18181b] border-neutral-800 text-white placeholder-neutral-600' 
                : 'bg-neutral-50 border-neutral-200 text-neutral-900 placeholder-neutral-400'
            }`}
            rows={3}
          />
        </div>

        <button
          disabled={utility === 0 || clarity === 0 || creativity === 0 || isSubmitting}
          onClick={handleSubmit}
          className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
            utility === 0 || clarity === 0 || creativity === 0 || isSubmitting
              ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
              : 'bg-zeno text-white hover:bg-zeno/90 shadow-lg shadow-zeno/20 active:scale-95'
          }`}
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              Enviar Avaliação
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default DetailedFeedbackForm;
