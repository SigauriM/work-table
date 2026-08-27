import { useMemo, useState, type ReactNode } from "react";
import { LocaleContext } from "./locale-context";
import { messages, type Locale } from "./messages";

const STORAGE = "worktable-locale";

function initialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE);
  if (saved === "en" || saved === "de") return saved;
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const value = useMemo(() => {
    const t = (key: keyof typeof messages.en) => messages[locale][key];
    const setLocale = (next: Locale) => {
      localStorage.setItem(STORAGE, next);
      setLocaleState(next);
    };
    return {
      locale,
      localeTag: locale === "de" ? "de-DE" : "en-US",
      t,
      setLocale,
    };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
