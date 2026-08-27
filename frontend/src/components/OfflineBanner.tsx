import { useEffect, useState } from "react";
import { useI18n } from "../i18n/useI18n";

export function OfflineBanner() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      className="bg-[var(--ts-ink)] px-4 py-2 text-center text-sm text-[var(--ts-bg)]"
    >
      {t("offline")}
    </div>
  );
}
