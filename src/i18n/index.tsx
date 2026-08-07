import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { pt } from './translations/pt';
import { es } from './translations/es';
import { fr } from './translations/fr';
import { zh } from './translations/zh';
import { en } from './translations/en';

export type Language = 'pt-BR' | 'en-US' | 'es-ES' | 'fr-FR' | 'zh-CN' | 'auto';

const translations = {
  'pt-BR': pt,
  'es-ES': es,
  'fr-FR': fr,
  'zh-CN': zh,
  'en-US': en,
};

type TranslationType = typeof pt;

interface LanguageContextType {
  language: Language;
  t: TranslationType;
  resolvedLanguage: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ 
  children, 
  userLanguage = 'auto'
}: { 
  children: ReactNode; 
  userLanguage?: Language;
}) {
  const resolvedLanguage = useMemo(() => {
    if (userLanguage === 'auto') {
      const browserLang = typeof navigator !== 'undefined' ? navigator.language : 'pt-BR';
      if (browserLang.startsWith('pt')) return 'pt-BR';
      if (browserLang.startsWith('en')) return 'en-US';
      if (browserLang.startsWith('es')) return 'es-ES';
      if (browserLang.startsWith('fr')) return 'fr-FR';
      if (browserLang.startsWith('zh')) return 'zh-CN';
      return 'pt-BR';
    }
    return userLanguage;
  }, [userLanguage]);

  const t = useMemo(() => {
    return translations[resolvedLanguage as keyof typeof translations] || pt;
  }, [resolvedLanguage]);

  const value = {
    language: userLanguage,
    t,
    resolvedLanguage
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
