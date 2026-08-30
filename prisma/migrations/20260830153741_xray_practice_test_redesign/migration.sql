/*
  Warnings:

  - You are about to drop the column `selfReported` on the `XrayPracticeAnswer` table. All the data in the column will be lost.
  - You are about to drop the column `difficulty` on the `XrayPracticeQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `format` on the `XrayPracticeQuestion` table. All the data in the column will be lost.
  - You are about to drop the column `options` on the `XrayPracticeQuestion` table. All the data in the column will be lost.
  - Added the required column `testId` to the `XrayPracticeAttempt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kazanimId` to the `XrayPracticeQuestion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order` to the `XrayPracticeQuestion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `testId` to the `XrayPracticeQuestion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `testName` to the `XrayPracticeQuestion` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "XrayPracticeQuestion_subject_subtopicId_difficulty_idx";

-- AlterTable
ALTER TABLE "XrayPracticeAnswer" DROP COLUMN "selfReported";

-- AlterTable
ALTER TABLE "XrayPracticeAttempt" ADD COLUMN     "testId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "XrayPracticeQuestion" DROP COLUMN "difficulty",
DROP COLUMN "format",
DROP COLUMN "options",
ADD COLUMN     "kazanimId" TEXT NOT NULL,
ADD COLUMN     "order" INTEGER NOT NULL,
ADD COLUMN     "testId" TEXT NOT NULL,
ADD COLUMN     "testName" TEXT NOT NULL;

-- DropEnum
DROP TYPE "XrayQuestionFormat";

-- CreateIndex
CREATE INDEX "XrayPracticeQuestion_subject_subtopicId_idx" ON "XrayPracticeQuestion"("subject", "subtopicId");

-- CreateIndex
CREATE INDEX "XrayPracticeQuestion_testId_idx" ON "XrayPracticeQuestion"("testId");
