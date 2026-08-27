import { createContext } from "react";
import type { Locale, MsgKey } from "./messages";

export type LocaleContextValue = {
  locale: Locale;
  localeTag: string;
  t: (key: MsgKey) => string;
  setLocale: (locale: Locale) => void;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);
