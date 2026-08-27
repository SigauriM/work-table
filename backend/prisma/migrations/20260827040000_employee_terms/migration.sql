-- CreateTable
CREATE TABLE "EmployeeTerms" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payType" "PayType" NOT NULL,
    "hourlyRate" DECIMAL(10,2),
    "monthlySalary" DECIMAL(10,2),
    "hoursPerDay" DECIMAL(4,2) NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,

    CONSTRAINT "EmployeeTerms_pkey" PRIMARY KEY ("id")
);

INSERT INTO "EmployeeTerms" ("id", "employeeId", "payType", "hourlyRate", "monthlySalary", "hoursPerDay", "validFrom", "validTo")
SELECT gen_random_uuid()::text,
       e."id",
       e."payType",
       e."hourlyRate",
       e."monthlySalary",
       e."hoursPerDay",
       (e."hiredAt" AT TIME ZONE 'UTC')::date,
       NULL
FROM "Employee" e;

-- CreateIndex
CREATE INDEX "EmployeeTerms_employeeId_validFrom_idx" ON "EmployeeTerms"("employeeId", "validFrom");

-- AddForeignKey
ALTER TABLE "EmployeeTerms" ADD CONSTRAINT "EmployeeTerms_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "hoursPerDay",
DROP COLUMN "hourlyRate",
DROP COLUMN "monthlySalary",
DROP COLUMN "payType";

-- AlterTable
ALTER TABLE "SickDay" DROP COLUMN "creditedHours";
