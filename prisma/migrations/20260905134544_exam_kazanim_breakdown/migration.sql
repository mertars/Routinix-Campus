-- AlterEnum
ALTER TYPE "XraySource" ADD VALUE 'PAPER_EXAM';

-- AlterTable
ALTER TABLE "ExamNetResult" ADD COLUMN     "blankQuestionNumbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "wrongQuestionNumbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "subtopicId" TEXT,
    "subtopicLabel" TEXT NOT NULL,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamQuestion_examId_subject_idx" ON "ExamQuestion"("examId", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestion_examId_subject_questionNumber_key" ON "ExamQuestion"("examId", "subject", "questionNumber");

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
