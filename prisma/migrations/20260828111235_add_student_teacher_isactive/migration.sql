-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'USER_DEACTIVATED';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
