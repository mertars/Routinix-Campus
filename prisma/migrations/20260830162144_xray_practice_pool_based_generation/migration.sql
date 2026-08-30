/*
  Warnings:

  - You are about to drop the column `testId` on the `XrayPracticeAttempt` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "XrayPracticeAttempt" DROP COLUMN "testId";

-- CreateTable
CREATE TABLE "XrayPracticeAttemptQuestion" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "XrayPracticeAttemptQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XrayPracticeAttemptQuestion_attemptId_idx" ON "XrayPracticeAttemptQuestion"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "XrayPracticeAttemptQuestion_attemptId_questionId_key" ON "XrayPracticeAttemptQuestion"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "XrayPracticeQuestion_subject_subtopicId_kazanimId_idx" ON "XrayPracticeQuestion"("subject", "subtopicId", "kazanimId");

-- AddForeignKey
ALTER TABLE "XrayPracticeAttemptQuestion" ADD CONSTRAINT "XrayPracticeAttemptQuestion_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "XrayPracticeAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayPracticeAttemptQuestion" ADD CONSTRAINT "XrayPracticeAttemptQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "XrayPracticeQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
