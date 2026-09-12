-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppointmentStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "AppointmentStatus" ADD VALUE 'NO_SHOW';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'APPOINTMENT_COMPLETION_RECORDED';

-- AlterTable
ALTER TABLE "AppointmentRequest" ADD COLUMN     "completionNote" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ClassbookNote" ADD COLUMN     "noteDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "answerImageUrl" TEXT;

-- AlterTable
ALTER TABLE "QuizBankQuestion" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "YearlyPlanRow" ADD COLUMN     "covered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "grade" INTEGER,
ADD COLUMN     "weekOrder" INTEGER;
