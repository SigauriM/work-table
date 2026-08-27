import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OfflineBanner } from "./components/OfflineBanner";
import { ToastProvider } from "./components/Toast";
import { LocaleProvider } from "./i18n/LocaleContext";
import { queryClient } from "./queryClient";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LocaleProvider>
          <ToastProvider>
            <AuthProvider>
              <ErrorBoundary>
                <OfflineBanner />
                <App />
              </ErrorBoundary>
            </AuthProvider>
          </ToastProvider>
        </LocaleProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
