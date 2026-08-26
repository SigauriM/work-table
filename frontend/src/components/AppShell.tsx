import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { BUILD_LABEL } from "../buildLabel";
import { btnSecondary } from "../ui";

export type NavItem = { to: string; label: string; end?: boolean };

export const employeeNav: NavItem[] = [
  { to: "/employee", label: "Timesheet", end: true },
  { to: "/employee/stats", label: "Stats" },
];

export const adminNav: NavItem[] = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/employees", label: "Employees" },
];

function linkClass(active: boolean) {
  return [
    "flex min-h-11 items-center justify-center rounded px-3 text-sm md:justify-start",
    active ? "bg-neutral-900 text-white" : "text-neutral-800",
  ].join(" ");
}

export function AppShell({
  title,
  nav,
  children,
}: {
  title: string;
  nav: NavItem[];
  children: ReactNode;
}) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-56 md:flex-col md:border-r md:border-neutral-200 md:bg-white">
        <div className="px-4 py-4">
          <div className="text-lg font-semibold">Work Table</div>
          <div className="text-sm text-neutral-600">{user?.login}</div>
          <div className="mt-1 text-xs text-neutral-400">{BUILD_LABEL}</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Main">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => linkClass(isActive)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2">
          <button
            type="button"
            className={`${btnSecondary} w-full`}
            onClick={() => void logout()}
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="md:pl-56">
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-white px-4 py-3 md:hidden">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-sm text-neutral-600">{user?.login}</p>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:gap-8 md:pb-8">
          <h1 className="hidden text-xl font-semibold md:block">{title}</h1>
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom,0px)] md:hidden"
          aria-label="Main"
        >
          <div className="grid grid-cols-3">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `${linkClass(isActive)} rounded-none`}
              >
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              className={`${btnSecondary} rounded-none border-0`}
              onClick={() => void logout()}
            >
              Log out
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
