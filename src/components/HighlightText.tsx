import React from 'react';

export const HighlightText = ({ text, query, isDark, snippetMode }: { text: string; query?: string; isDark: boolean; snippetMode?: boolean }) => {
  if (!query || !query.trim()) return <>{text}</>;
  
  let displayText = text;
  const matchIndex = text.toLowerCase().indexOf(query.toLowerCase());
  
  if (snippetMode && matchIndex > -1 && text.length > 60) {
    const start = Math.max(0, matchIndex - 20);
    const end = Math.min(text.length, matchIndex + query.length + 30);
    displayText = (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
  }
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = displayText.split(regex);
  
  return (
    <>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} className={`bg-zeno/20 text-zeno rounded-sm px-0.5 font-semibold`}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};
