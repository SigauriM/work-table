import { useCallback, useState, type ReactNode } from "react";
import { ToastContext } from "./toast-context";

type Toast = { id: number; text: string };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto max-w-sm rounded-lg bg-[var(--ts-ink)] px-4 py-3 text-sm text-[var(--ts-bg)] shadow"
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
