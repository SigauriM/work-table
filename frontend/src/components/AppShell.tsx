import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { BUILD_LABEL } from "../buildLabel";
import { useI18n } from "../i18n/useI18n";
import type { NavItem } from "./nav";

function linkClass(active: boolean) {
  return [
    "flex min-h-11 items-center justify-center rounded px-3 text-sm md:justify-start",
    active ? "font-semibold text-[var(--ts-ink)]" : "text-[var(--ts-mute)]",
  ].join(" ");
}

export function AppShell({
  title,
  nav,
  children,
  hideHeader = false,
  flush = false,
}: {
  title: string;
  nav: NavItem[];
  children: ReactNode;
  hideHeader?: boolean;
  flush?: boolean;
}) {
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();

  return (
    <div className="min-h-dvh bg-[var(--ts-bg)] text-[var(--ts-ink)]">
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-56 md:flex-col md:border-r md:border-[var(--ts-line)] md:bg-[var(--ts-bg)]">
        <div className="px-4 py-4">
          <div className="text-lg font-bold tracking-tight">Work Table</div>
          <div className="text-sm text-[var(--ts-mute)]">{user?.login}</div>
          <div className="mt-1 text-xs text-[var(--ts-faint)]">{BUILD_LABEL}</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Main">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => linkClass(isActive)}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col gap-1 p-2">
          <div className="flex gap-1 px-1">
            <button
              type="button"
              className={`min-h-11 flex-1 rounded text-xs font-semibold ${locale === "en" ? "text-[var(--ts-ink)]" : "text-[var(--ts-mute)]"}`}
              aria-pressed={locale === "en"}
              onClick={() => setLocale("en")}
            >
              EN
            </button>
            <button
              type="button"
              className={`min-h-11 flex-1 rounded text-xs font-semibold ${locale === "de" ? "text-[var(--ts-ink)]" : "text-[var(--ts-mute)]"}`}
              aria-pressed={locale === "de"}
              onClick={() => setLocale("de")}
            >
              DE
            </button>
          </div>
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-center rounded-full text-sm font-semibold text-[var(--ts-mute)]"
            onClick={() => void logout()}
          >
            {t("logOut")}
          </button>
        </div>
      </aside>

      <div className="md:pl-56">
        {!hideHeader ? (
          <header className="flex items-center justify-between gap-2 border-b border-[var(--ts-line)] bg-[var(--ts-bg)] px-4 py-3 md:hidden">
            <div>
              <h1 className="text-lg font-bold tracking-tight">{title}</h1>
              <p className="text-sm text-[var(--ts-mute)]">{user?.login}</p>
            </div>
          </header>
        ) : null}

        <main
          className={
            flush
              ? "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-0"
              : "mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:gap-8 md:pb-8"
          }
        >
          {!hideHeader ? (
            <h1 className="hidden text-xl font-bold tracking-tight md:block">{title}</h1>
          ) : null}
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--ts-line)] bg-[var(--ts-bg)] pb-[env(safe-area-inset-bottom,0px)] md:hidden"
          aria-label="Main"
        >
          <div className="grid grid-cols-3 px-2 py-3 text-xs">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-11 items-center justify-center ${
                    isActive ? "font-semibold text-[var(--ts-ink)]" : "text-[var(--ts-mute)]"
                  }`
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
            <button
              type="button"
              className="flex min-h-11 items-center justify-center text-[var(--ts-mute)]"
              onClick={() => void logout()}
            >
              {t("logOut")}
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
