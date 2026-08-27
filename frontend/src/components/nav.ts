export type NavItem = { to: string; label: string; end?: boolean };

export const employeeNav: NavItem[] = [
  { to: "/employee", label: "Timesheet", end: true },
  { to: "/employee/stats", label: "Stats" },
];

export const adminNav: NavItem[] = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/employees", label: "Employees" },
];
