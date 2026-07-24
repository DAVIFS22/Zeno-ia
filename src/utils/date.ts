import { ChatSession } from '../types';

export type SessionGroup = {
  label: string;
  sessions: ChatSession[];
};

export function groupSessionsByDate(sessions: ChatSession[], groupByDate: boolean = true): SessionGroup[] {
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  
  const pinnedSessions = sorted.filter(s => s.isPinned);
  const unpinnedSessions = sorted.filter(s => !s.isPinned);

  const result: SessionGroup[] = [];

  if (pinnedSessions.length > 0) {
    result.push({
      label: 'Fixados',
      sessions: pinnedSessions,
    });
  }

  if (!groupByDate) {
    if (unpinnedSessions.length > 0) {
      result.push({
        label: '',
        sessions: unpinnedSessions,
      });
    }
    return result;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = today - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = today - 30 * 24 * 60 * 60 * 1000;

  const groups: Record<string, ChatSession[]> = {
    Hoje: [],
    Ontem: [],
    'Últimos 7 dias': [],
    'Últimos 30 dias': [],
    'Mais antigos': [],
  };

  unpinnedSessions.forEach((session) => {
    const sessionTime = session.updatedAt;
    if (sessionTime >= today) {
      groups['Hoje'].push(session);
    } else if (sessionTime >= yesterday) {
      groups['Ontem'].push(session);
    } else if (sessionTime >= sevenDaysAgo) {
      groups['Últimos 7 dias'].push(session);
    } else if (sessionTime >= thirtyDaysAgo) {
      groups['Últimos 30 dias'].push(session);
    } else {
      groups['Mais antigos'].push(session);
    }
  });

  Object.entries(groups).forEach(([label, list]) => {
    if (list.length > 0) {
      result.push({ label, sessions: list });
    }
  });

  return result;
}

/**
 * Enhances raw user message text into a clean, concise, human-friendly title.
 * Strips markdown, URLs, code snippets, and conversational noise,
 * then cleanly truncates at word boundaries.
 */
export function generateTitleFromMessage(message: string): string {
  if (!message || typeof message !== 'string') return 'Novo Chat';

  let cleaned = message
    // Remove image syntax ![alt](url)
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Remove links [text](url) -> text
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove headers, bold, italics, quotes, newlines
    .replace(/[#*_\n\r\t]/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Remove common Portuguese/English conversational opening prefixes
  cleaned = cleaned.replace(/^(olá|ola|oi|hey|hello|por favor|me ajude a|como|gostaria de|como faço para|pode me dizer|me explique|o que é|qual é|qual o|quais são|crie um|crie uma|me dê|me de|escreva|fale sobre)\s+/i, '');

  if (!cleaned) return 'Novo Chat';

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Word-boundary truncation
  const MAX_LEN = 36;
  if (cleaned.length <= MAX_LEN) {
    return cleaned;
  }

  const truncated = cleaned.slice(0, MAX_LEN);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 12) {
    return truncated.slice(0, lastSpace).trim() + '...';
  }

  return truncated.trim() + '...';
}

