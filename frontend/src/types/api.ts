export type Role = "ADMIN" | "EMPLOYEE";

export type PublicUser = {
  id: string;
  login: string;
  role: Role;
  employeeId: string | null;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
};

export type ApiErrorBody = {
  error: string;
};

export type PayType = "HOURLY" | "SALARY";

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
  hoursPerMonth: string;
  hiredAt: string;
  isActive: boolean;
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
  hoursPerMonth: string;
  hiredAt: string;
};

export type UpdateEmployeeBody = {
  firstName?: string;
  lastName?: string;
  payType?: PayType;
  hourlyRate?: string | null;
  monthlySalary?: string | null;
  hoursPerDay?: string;
  daysPerWeek?: number;
  hoursPerMonth?: string;
  hiredAt?: string;
  isActive?: boolean;
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

export type SalaryPayout = {
  id: string;
  employeeId: string;
  year: number;
  month: number;
  amount: string;
  paidAt: string;
  note: string | null;
};

export type CreateOvertimePayoutBody = {
  date: string;
  hoursPaid: string;
  amount: string;
  note?: string;
};

export type CreateSalaryPayoutBody = {
  year: number;
  month: number;
  amount: string;
  paidAt: string;
  note?: string;
};