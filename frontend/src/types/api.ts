export type Role = "ADMIN" | "EMPLOYEE";

export type PublicUser = {
  id: string;
  login: string;
  role: Role;
  employeeId: string | null;
  mustChangePassword: boolean;
};

export type AuthResponse = {
  accessToken: string;
  user: PublicUser;
};

export type ApiErrorBody = {
  error: string;
  code?: string;
};

export type PayType = "HOURLY" | "SALARY";

export type EmployeeTerms = {
  payType: PayType;
  hourlyRate: string | null;
  monthlySalary: string | null;
  hoursPerDay: string;
  validFrom: string;
  validTo: string | null;
};

export type Employee = {
  id: string;
  userId: string;
  login: string;
  firstName: string;
  lastName: string;
  payType: PayType;
  hourlyRate: string | null;
  monthlySalary: string | null;
  hoursPerDay: string;
  daysPerWeek: number;
  hiredAt: string;
  isActive: boolean;
  terms?: EmployeeTerms[];
};

export type Shift = {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  workedMinutes: number;
  note: string | null;
};

export type ShiftPage = {
  items: Shift[];
  nextCursor: string | null;
};

export type SickDay = {
  id: string;
  employeeId: string;
  date: string;
  note: string | null;
};

export type EmployeeStats = {
  employeeId: string;
  year: number;
  month: number;
  workedHours: string;
  normHours: string;
  balance: string;
  monthlyPay: string;
  totalBalance: string;
  paidOvertimeHours: string;
  paidTotal: string;
  paidBase: string;
  paidOvertimeAmount: string;
  hoursPerDay: string;
  terms?: EmployeeTerms[];
};

export type OverviewRow = {
  employeeId: string;
  login: string;
  firstName: string;
  lastName: string;
  workedHours: string;
  balance: string;
  monthlyPay: string;
};

export type AuditEntity = "Shift" | "Employee" | "User" | "OvertimePayout";

export type AuditLogItem = {
  id: string;
  createdAt: string;
  actorUserId: string;
  actorLogin: string | null;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
};

export type AuditLogPage = {
  items: AuditLogItem[];
  nextCursor: string | null;
};

export type CreateEmployeeBody = {
  login: string;
  password: string;
  firstName: string;
  lastName: string;
  payType: PayType;
  hourlyRate?: string;
  monthlySalary?: string;
  hoursPerDay: string;
  daysPerWeek: number;
  hiredAt: string;
};

export type UpdateEmployeeBody = {
  login?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  payType?: PayType;
  hourlyRate?: string | null;
  monthlySalary?: string | null;
  hoursPerDay?: string;
  daysPerWeek?: number;
  hiredAt?: string;
  isActive?: boolean;
  effectiveFrom?: string;
};

export type CreateShiftBody = {
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  note?: string;
};

export type UpdateShiftBody = {
  date?: string;
  startTime?: string;
  endTime?: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  note?: string | null;
};

export type CreateSickDayBody = {
  employeeId: string;
  date: string;
  note?: string;
};

export type OvertimePayout = {
  id: string;
  employeeId: string;
  date: string;
  hoursPaid: string;
  amount: string;
  note: string | null;
};

export type CreateOvertimePayoutBody = {
  date: string;
  hoursPaid: string;
  amount: string;
  note?: string;
};