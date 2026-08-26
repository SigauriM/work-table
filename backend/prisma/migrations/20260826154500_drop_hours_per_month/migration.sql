-- Daily overtime/undertime uses hoursPerDay; monthly lump norm is unused.
ALTER TABLE "Employee" DROP COLUMN "hoursPerMonth";
