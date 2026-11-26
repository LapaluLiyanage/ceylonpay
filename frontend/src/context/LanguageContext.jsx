import { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_LANGUAGE, LANGUAGES, LOCALES, uiText } from '../i18n/strings';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'ceylonpay_lang';

function initialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {
    // storage unavailable (private mode): just use the default
  }
  return DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(code) {
    setLangState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // not persisted; still applies for this visit
    }
  }

  const t = (key, vars) => uiText(lang, key, vars);
  const locale = LOCALES[lang] || LOCALES[DEFAULT_LANGUAGE];

  return <LanguageContext.Provider value={{ lang, setLang, t, locale }}>{children}</LanguageContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
