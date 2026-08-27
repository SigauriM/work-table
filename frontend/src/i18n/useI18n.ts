import { useContext } from "react";
import { LocaleContext } from "./locale-context";

export function useI18n() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useI18n outside LocaleProvider");
  return ctx;
}
