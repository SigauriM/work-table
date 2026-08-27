import { createContext } from "react";

export const ToastContext = createContext<{ show: (text: string) => void } | null>(null);
