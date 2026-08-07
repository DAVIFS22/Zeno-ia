import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Bot, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

interface SupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const SupportChatModal: React.FC<SupportChatModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Olá! Sou o assistente de Suporte e FAQ do ZENO AI. Como posso te ajudar hoje com suas dúvidas sobre planos, cobranças ou sobre o aplicativo?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, activeTool]);

  if (!isOpen) return null;

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    setActiveTool(null);

    try {
      const token = await user?.getIdToken();
      await processTurn([...messages, userMessage], null, token);
    } catch (err: any) {
      console.error("[Support Chat Client Error]:", err);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: 'Falha na conexão com o servidor. Tente novamente mais tarde.' }]);
      setIsTyping(false);
      setActiveTool(null);
    }
  };

  const processTurn = async (currentMessages: Message[], actionCallback?: any, token?: string) => {
    const activeToken = token || await user?.getIdToken();
    
    const res = await fetch('/api/support/chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeToken}`
      },
      body: JSON.stringify({
        messages: currentMessages,
        userId: user?.uid,
        email: user?.email,
        actionCallback
      })
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro ${res.status}`);
    }

    const data = await res.json();
    
    if (data.error) throw new Error(data.error);

    if (data.toolCall) {
       setActiveTool(data.toolCall.name);
       const systemMsg: Message = { id: Date.now().toString(), role: 'system', content: data.toolCall.result };
       setMessages(prev => [...prev, systemMsg]);
       
       // Send result back to model
       const cb = {
          role: "function",
          parts: [{
             functionResponse: {
                name: data.toolCall.name,
                response: { result: data.toolCall.result }
             }
          }]
       };
       // Artificial delay to show the tool calling state
       await new Promise(r => setTimeout(r, 1500));
       await processTurn([...currentMessages, systemMsg], cb, activeToken);
    } else if (data.reply) {
       setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: data.reply }]);
       setIsTyping(false);
       setActiveTool(null);
    } else {
       setIsTyping(false);
       setActiveTool(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="relative w-full max-w-lg bg-[#121215] rounded-3xl shadow-2xl border border-neutral-800 flex flex-col overflow-hidden"
        style={{ height: '80vh', maxHeight: '700px' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
              <Bot className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Suporte ZENO AI</h2>
              <p className="text-xs text-neutral-400">Tire suas dúvidas ou envie uma reclamação</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-neutral-700">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {msg.role !== 'system' && (
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-neutral-800' : 'bg-blue-600/20 text-blue-400'}`}>
                    {msg.role === 'user' ? <User className="w-4 h-4 text-neutral-400" /> : <Bot className="w-4 h-4" />}
                  </div>
                )}
                <div className={`p-3 rounded-2xl text-sm ${
                  msg.role === 'user' ? 'bg-neutral-800 text-white rounded-tr-sm' : 
                  msg.role === 'system' ? 'bg-neutral-900/80 border border-neutral-800 text-neutral-400 w-full text-center italic' :
                  'bg-blue-900/20 border border-blue-500/20 text-neutral-200 rounded-tl-sm'
                }`}>
                  {msg.role === 'system' && (
                     <div className="flex items-center justify-center gap-2 mb-1">
                        {msg.content.includes('sucesso') ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertCircle className="w-4 h-4 text-neutral-500" />}
                     </div>
                  )}
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isTyping && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400">
                <Bot className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="p-3 rounded-2xl bg-blue-900/20 border border-blue-500/20 rounded-tl-sm flex items-center gap-1.5">
                  {activeTool ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  ) : (
                    <>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-neutral-500 ml-1 animate-pulse">
                  {activeTool === 'createSupportTicket' ? 'Abrindo ticket de suporte...' : 
                   activeTool === 'cancelSubscription' ? 'Processando cancelamento...' : 
                   activeTool ? 'Executando ferramenta...' : 'Processando sua solicitação...'}
                </p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-neutral-800 bg-neutral-900/30">
          <form onSubmit={sendMessage} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua dúvida ou problema..."
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white text-black rounded-lg disabled:opacity-50 disabled:bg-neutral-700 disabled:text-neutral-400 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
