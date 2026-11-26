import { useLanguage } from '../context/LanguageContext';
import { LANGUAGES } from '../i18n/strings';
import { C } from './ui';

/** The EN / සිං / தமிழ் buttons. `track` is the colour behind them; `stretch` makes them share the width. */
export function LanguageSwitch({ stretch, track }) {
  const { lang, setLang } = useLanguage();
  return (
    <div role="group" aria-label="Language" style={{ display: 'flex', background: track, borderRadius: 999, padding: 3, gap: 2 }}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          title={l.name}
          style={{
            flex: stretch ? 1 : 'none',
            height: 32,
            minWidth: 38,
            padding: '0 8px',
            borderRadius: 999,
            background: lang === l.code ? C.accent : 'transparent',
            color: lang === l.code ? '#fff' : C.text,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
