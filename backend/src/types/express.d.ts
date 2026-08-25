import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: Role;
        employeeId: string | null;
      };
    }
  }
}

export {};