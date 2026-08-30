/*
  Warnings:

  - Added the required column `assignedById` to the `XrayPracticeAttempt` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "XrayPracticeAttempt" ADD COLUMN     "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "assignedById" TEXT NOT NULL,
ADD COLUMN     "status" "XrayAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
ALTER COLUMN "startedAt" DROP NOT NULL,
ALTER COLUMN "startedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "XrayPracticeAttempt_assignedById_idx" ON "XrayPracticeAttempt"("assignedById");

-- AddForeignKey
ALTER TABLE "XrayPracticeAttempt" ADD CONSTRAINT "XrayPracticeAttempt_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
