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
    // STRICT OVERRIDE: Forcing pt-BR to prevent language leaking (e.g. Chinese characters)
    return 'pt-BR';
  }, [userLanguage]);

  const t = useMemo(() => {
    return pt; // STRICTLY bind to Portuguese translations
  }, [resolvedLanguage]);

  const value = useMemo(() => ({
    language: 'pt-BR' as Language,
    t,
    resolvedLanguage: 'pt-BR'
  }), [t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation(componentName?: string) {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  
  if (componentName) {
    console.log(`[Diagnostic] ${componentName} is using language context: pt-BR`);
  }
  
  return context;
}
