import { Component, type ErrorInfo, type ReactNode } from "react";
import { useI18n } from "../i18n/useI18n";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { failed: boolean };

function DefaultFallback() {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh bg-[var(--ts-bg)] p-6 text-[var(--ts-ink)]" role="alert">
      {t("somethingWrong")}
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback ?? <DefaultFallback />;
    }
    return this.props.children;
  }
}
