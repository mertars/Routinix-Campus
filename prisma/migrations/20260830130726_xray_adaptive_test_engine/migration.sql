-- CreateEnum
CREATE TYPE "XraySource" AS ENUM ('AI_TEST', 'TEACHER_OVERRIDE');

-- CreateEnum
CREATE TYPE "XrayTestStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- DropForeignKey
ALTER TABLE "TopicMasteryAssessment" DROP CONSTRAINT "TopicMasteryAssessment_assessedById_fkey";

-- AlterTable
ALTER TABLE "TopicMasteryAssessment" ADD COLUMN     "source" "XraySource" NOT NULL DEFAULT 'AI_TEST',
ADD COLUMN     "sourceSessionId" TEXT,
ALTER COLUMN "assessedById" DROP NOT NULL;

-- CreateTable
CREATE TABLE "XrayQuestion" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subtopicId" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" TEXT[],
    "correctAnswer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XrayQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XrayTestSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "XrayTestStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "XrayTestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XrayTestAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "subtopicId" TEXT NOT NULL,
    "selectedAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XrayTestAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XrayQuestion_subject_subtopicId_difficulty_idx" ON "XrayQuestion"("subject", "subtopicId", "difficulty");

-- CreateIndex
CREATE INDEX "XrayTestSession_studentId_idx" ON "XrayTestSession"("studentId");

-- CreateIndex
CREATE INDEX "XrayTestAnswer_sessionId_idx" ON "XrayTestAnswer"("sessionId");

-- CreateIndex
CREATE INDEX "XrayTestAnswer_subtopicId_idx" ON "XrayTestAnswer"("subtopicId");

-- AddForeignKey
ALTER TABLE "XrayTestSession" ADD CONSTRAINT "XrayTestSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayTestAnswer" ADD CONSTRAINT "XrayTestAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "XrayTestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayTestAnswer" ADD CONSTRAINT "XrayTestAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "XrayQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicMasteryAssessment" ADD CONSTRAINT "TopicMasteryAssessment_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
