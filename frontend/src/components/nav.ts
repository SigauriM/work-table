import type { MsgKey } from "../i18n/messages";

export type NavItem = { to: string; labelKey: MsgKey; end?: boolean };

export const employeeNav: NavItem[] = [
  { to: "/employee", labelKey: "navTimesheet", end: true },
  { to: "/employee/stats", labelKey: "navStats" },
];

export const adminNav: NavItem[] = [
  { to: "/admin", labelKey: "navOverview", end: true },
  { to: "/admin/employees", labelKey: "navEmployees" },
];
