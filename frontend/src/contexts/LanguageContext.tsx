import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translations, type Lang, type TranslationKey } from "../locales";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "appLang";
const DEFAULT_LANG: Lang = "en";

export const LANGUAGE_OPTIONS: {
  value: Lang;
  nativeName: string;
  englishName: string;
}[] = [
  { value: "en", nativeName: "English",   englishName: "English" },
  { value: "th", nativeName: "ภาษาไทย",   englishName: "Thai" },
  { value: "zh", nativeName: "中文",       englishName: "Chinese" },
];

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved === "en" || saved === "th" || saved === "zh") ? saved : DEFAULT_LANG;
  });

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      const dict = translations[lang] as Record<string, string>;
      let text = dict[key] ?? (translations.en as Record<string, string>)[key] ?? key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, String(v));
        });
      }
      return text;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
