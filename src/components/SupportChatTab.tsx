import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, CheckCircle2, AlertCircle, LifeBuoy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const SupportChatTab: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const storageKeyChat = `zeno_support_chat_${user?.uid || 'guest'}`;
  const storageKeyActivity = `zeno_support_activity_${user?.uid || 'guest'}`;

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const savedActivity = localStorage.getItem(storageKeyActivity);
      const savedChat = localStorage.getItem(storageKeyChat);
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

      if (savedActivity && savedChat) {
        const lastActivity = parseInt(savedActivity, 10);
        if (now - lastActivity < TWENTY_FOUR_HOURS) {
          const parsed = JSON.parse(savedChat);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn("Error reading support chat storage:", e);
    }
    return [
      { id: '1', role: 'assistant', content: t.supportChat?.greeting || 'Olá! Sou o assistente de Suporte e FAQ do ZENO AI. Como posso te ajudar hoje com suas dúvidas sobre planos, cobranças ou sobre o aplicativo?' }
    ];
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Listen for active ticket
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'supportTickets'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const userTickets = tickets.filter((t: any) => t.userId === user.uid || t.userEmail === user.email);
      const active = userTickets.find((t: any) => t.status === 'pending_human' || t.status === 'human_active');
      if (active) {
        setActiveTicket(active);
      } else {
        setActiveTicket(null);
      }
    }, (error) => {
      console.warn("[Support Chat] Erro ao buscar tickets:", error);
    });

    return () => unsubscribe();
  }, [user?.uid, user?.email]);

  // 2. Listen for ticket messages if active
  useEffect(() => {
    if (!activeTicket) return;

    const q = query(
      collection(db, 'supportTickets', activeTicket.id, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          role: data.sender === 'user' ? 'user' : data.sender === 'ai' ? 'assistant' : 'assistant', // mapping for UI
          content: data.text,
          senderType: data.sender // preserve original sender for visual differentiation
        } as any;
      });
      if (msgs.length > 0) {
        setMessages(msgs);
        setIsTyping(false); // Stop typing if we get a message
      }
    });

    return () => unsubscribe();
  }, [activeTicket?.id]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKeyChat, JSON.stringify(messages));
      localStorage.setItem(storageKeyActivity, Date.now().toString());
    } catch (e) {
      console.warn("Error saving support chat storage:", e);
    }
  }, [messages, user?.uid]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    
    // If not in handoff, update local state immediately for snappy UI
    if (!activeTicket) {
      setMessages(prev => [...prev, userMessage]);
    }
    
    setInput('');
    setIsTyping(true);

    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          messages: !activeTicket ? [...messages, userMessage] : [userMessage]
        })
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      if (data.handoff) {
        // Ticket is already active, Firestore listener will catch the message
        if (data.status === 'pending_human') {
          setIsTyping(false);
        }
        return;
      }

      if (data.toolCall) {
         const systemMsg: Message = { id: Date.now().toString(), role: 'system', content: data.toolCall.result };
         setMessages(prev => [...prev, systemMsg]);
         
         const cb = {
            role: "function",
            parts: [{
               functionResponse: {
                  name: data.toolCall.name,
                  response: { result: data.toolCall.result }
               }
            }]
         };
         // Note: processTurn was replaced by this fetch logic, so we might need to handle recursion if tool calls continue
         // But for support tickets, it usually stops there.
         setIsTyping(false);
      } else if (data.reply) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: data.reply }]);
        setIsTyping(false);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: t.supportChat?.connectionError || 'Falha na conexão com o servidor. Tente novamente mais tarde.' }]);
      setIsTyping(false);
    }
  };

  const processTurn = async (currentMessages: Message[], actionCallback?: any) => {
    // This is now redundant but keeping signature if needed by other components
  };

  return (
    <div className="flex flex-col h-full animate-fadeIn max-w-2xl mx-auto w-full">
      <div className="flex flex-col items-center justify-center text-center mb-8 mt-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-3 shadow-xs">
          <Bot className="w-3.5 h-3.5 text-neutral-500" />
          Suporte ZENO
        </div>
        <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
          <Bot className="w-6 h-6 text-neutral-900 dark:text-neutral-100" />
        </div>
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white tracking-tight">{t.supportChat?.title || 'Ajuda e Suporte'}</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-md">{t.supportChat?.subtitle || 'Tire dúvidas sobre planos, cobranças ou reporte problemas para nossa equipe.'}</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 px-1 scrollbar-thin scrollbar-thumb-neutral-200 dark:scrollbar-thumb-neutral-800 min-h-[300px] mb-4">
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const isSystem = m.role === 'system';
            const isAdmin = (m as any).senderType === 'admin';
            
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start gap-2.5 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {!isSystem && (
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center border shadow-sm ${
                      m.role === 'user' 
                        ? 'bg-sky-500 border-sky-400' 
                        : isAdmin 
                          ? 'bg-indigo-600 border-indigo-500' 
                          : 'bg-neutral-800 border-neutral-700'
                    }`}>
                      {m.role === 'user' ? (
                        <User className="w-4 h-4 text-white" />
                      ) : isAdmin ? (
                        <LifeBuoy className="w-4 h-4 text-white" />
                      ) : (
                        <Bot className="w-4 h-4 text-sky-400" />
                      )}
                    </div>
                  )}
                  <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} gap-1`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-xs ${
                      m.role === 'user' 
                        ? 'bg-sky-600 text-white rounded-tr-none' 
                        : isSystem
                          ? 'bg-neutral-800/50 text-neutral-400 border border-neutral-700/30 w-full text-center italic'
                          : isAdmin
                            ? 'bg-indigo-600/10 text-indigo-200 border border-indigo-500/20 rounded-tl-none'
                            : 'bg-neutral-800 text-neutral-300 rounded-tl-none border border-neutral-700/50'
                    }`}>
                      {!isSystem && (
                        <span className="font-bold text-[10px] block mb-0.5 uppercase tracking-wider opacity-60">
                          {m.role === 'user' ? 'Você' : isAdmin ? 'Suporte ZENO' : 'ZENO IA'}
                        </span>
                      )}
                      {m.content}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {isTyping && (
          <div className="flex gap-3 max-w-[90%]">
            <div className="w-8 h-8 rounded-full bg-white dark:bg-[#1A1A1D] border border-neutral-200 dark:border-[#2C2C2E] flex items-center justify-center">
              <Bot className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1A1A1D] border border-neutral-200 dark:border-[#2C2C2E] rounded-tl-sm flex items-center gap-1.5 shadow-sm">
              <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="relative mt-auto">
        <form onSubmit={sendMessage} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.supportChat?.placeholder || "Digite sua mensagem..."}
            className="w-full bg-white dark:bg-[#1A1A1D] border border-neutral-200 dark:border-[#2C2C2E] rounded-2xl py-3.5 pl-5 pr-14 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600 focus:ring-4 focus:ring-neutral-100 dark:focus:ring-neutral-800/50 transition-all shadow-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center bg-neutral-900 dark:bg-white text-white dark:text-black rounded-xl disabled:opacity-50 disabled:bg-neutral-200 dark:disabled:bg-neutral-800 disabled:text-neutral-400 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
