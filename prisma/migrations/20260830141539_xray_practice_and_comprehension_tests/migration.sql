-- CreateEnum
CREATE TYPE "XrayQuestionFormat" AS ENUM ('OPEN_ENDED', 'MULTIPLE_CHOICE');

-- CreateEnum
CREATE TYPE "XrayAssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'FLAGGED');

-- CreateTable
CREATE TABLE "XrayPracticeQuestion" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subtopicId" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "format" "XrayQuestionFormat" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" TEXT[],
    "correctAnswer" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "checks" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XrayPracticeQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XrayPracticeAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subtopicId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "XrayPracticeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XrayPracticeAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "wasCorrect" BOOLEAN NOT NULL,
    "selfReported" BOOLEAN NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XrayPracticeAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XrayComprehensionQuestion" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subtopicId" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XrayComprehensionQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XrayComprehensionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "XrayComprehensionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XrayComprehensionAssignment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subtopicId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "status" "XrayAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "flagReason" TEXT,

    CONSTRAINT "XrayComprehensionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XrayComprehensionAnswer" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionId" TEXT NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XrayComprehensionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XrayPracticeQuestion_subject_subtopicId_difficulty_idx" ON "XrayPracticeQuestion"("subject", "subtopicId", "difficulty");

-- CreateIndex
CREATE INDEX "XrayPracticeAttempt_studentId_idx" ON "XrayPracticeAttempt"("studentId");

-- CreateIndex
CREATE INDEX "XrayPracticeAnswer_attemptId_idx" ON "XrayPracticeAnswer"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "XrayPracticeAnswer_attemptId_questionId_key" ON "XrayPracticeAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "XrayComprehensionQuestion_subject_subtopicId_idx" ON "XrayComprehensionQuestion"("subject", "subtopicId");

-- CreateIndex
CREATE INDEX "XrayComprehensionOption_questionId_idx" ON "XrayComprehensionOption"("questionId");

-- CreateIndex
CREATE INDEX "XrayComprehensionAssignment_studentId_idx" ON "XrayComprehensionAssignment"("studentId");

-- CreateIndex
CREATE INDEX "XrayComprehensionAssignment_assignedById_idx" ON "XrayComprehensionAssignment"("assignedById");

-- CreateIndex
CREATE INDEX "XrayComprehensionAnswer_assignmentId_idx" ON "XrayComprehensionAnswer"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "XrayComprehensionAnswer_assignmentId_questionId_key" ON "XrayComprehensionAnswer"("assignmentId", "questionId");

-- AddForeignKey
ALTER TABLE "XrayPracticeAttempt" ADD CONSTRAINT "XrayPracticeAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayPracticeAnswer" ADD CONSTRAINT "XrayPracticeAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "XrayPracticeAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayPracticeAnswer" ADD CONSTRAINT "XrayPracticeAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "XrayPracticeQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayComprehensionOption" ADD CONSTRAINT "XrayComprehensionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "XrayComprehensionQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayComprehensionAssignment" ADD CONSTRAINT "XrayComprehensionAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayComprehensionAssignment" ADD CONSTRAINT "XrayComprehensionAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayComprehensionAnswer" ADD CONSTRAINT "XrayComprehensionAnswer_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "XrayComprehensionAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayComprehensionAnswer" ADD CONSTRAINT "XrayComprehensionAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "XrayComprehensionQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayComprehensionAnswer" ADD CONSTRAINT "XrayComprehensionAnswer_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "XrayComprehensionOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
