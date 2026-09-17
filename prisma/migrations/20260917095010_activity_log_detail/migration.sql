-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "category" TEXT,
ADD COLUMN     "details" JSONB,
ADD COLUMN     "summary" TEXT;
