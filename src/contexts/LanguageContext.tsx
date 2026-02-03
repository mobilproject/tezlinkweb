import React, { createContext, useState, useContext } from 'react';
import type { ReactNode } from 'react';
import { translations } from '../translations';
import type { Language } from '../translations';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const fallbackLang = 'en';
type TranslationKey = keyof typeof translations[typeof fallbackLang];

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>('uz'); // Default to Uzbek for Chust

    const t = (key: TranslationKey) => {
        // Safe access ensuring fallback
        const langData = translations[language] as Record<string, string>;
        const fallbackData = translations[fallbackLang] as Record<string, string>;
        return langData[key] || fallbackData[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
