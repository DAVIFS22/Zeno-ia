import React, { useState, useEffect } from 'react';
import { MessageSquare, FileText, Sparkles, TrendingUp, HelpCircle } from 'lucide-react';
import { FileAttachment as Attachment } from '../types';
import { ChatSession } from '../types';

interface ContextualPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  recentSessions: ChatSession[];
  attachments: Attachment[];
}

export function ContextualPrompts({ onSelectPrompt, recentSessions, attachments }: ContextualPromptsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchSuggestions() {
      setIsLoading(true);
      try {
        const recentHistory = recentSessions.slice(0, 5).map(s => s.title || s.messages[0]?.text).filter(Boolean);
        const recentFiles = attachments.map(a => a.name);
        
        const res = await fetch('/api/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            history: recentHistory,
            files: recentFiles
          })
        });
        
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.suggestions) {
            setSuggestions(data.suggestions);
          }
        }
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    
    fetchSuggestions();
    
    return () => {
      isMounted = false;
    };
  }, [recentSessions, attachments]);

  if (suggestions.length === 0 && !isLoading) return null;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 mb-6 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 font-medium px-1">
        <Sparkles className="w-4 h-4 text-sky-500" />
        <span>Sugestões para começar</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {isLoading ? (
          <>
            <div className="h-16 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl animate-pulse"></div>
            <div className="h-16 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl animate-pulse"></div>
            <div className="h-16 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl animate-pulse md:block hidden"></div>
            <div className="h-16 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl animate-pulse md:block hidden"></div>
          </>
        ) : (
          suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => onSelectPrompt(suggestion)}
              className="text-left px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-sky-500 dark:hover:border-sky-500 transition-colors group flex items-start gap-3 shadow-sm"
            >
              <div className="mt-0.5 bg-sky-50 dark:bg-sky-500/10 p-1.5 rounded-lg text-sky-600 dark:text-sky-400">
                {attachments.length > 0 ? (
                   <FileText className="w-4 h-4" />
                ) : (
                   <MessageSquare className="w-4 h-4 group-hover:scale-110 transition-transform" />
                )}
              </div>
              <span className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                {suggestion}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
