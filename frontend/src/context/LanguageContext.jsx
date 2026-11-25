import { createContext, useContext, useState } from 'react';
import { DEFAULT_LANGUAGE, LANGUAGES, uiText } from '../i18n/strings';

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

  function setLang(code) {
    setLangState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // not persisted; still applies for this visit
    }
  }

  const t = (key) => uiText(lang, key);

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
