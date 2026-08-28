-- CreateTable
CREATE TABLE "StudyGoal" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "targetQuestions" INTEGER,
    "targetMinutes" INTEGER,
    "progressQuestions" INTEGER NOT NULL DEFAULT 0,
    "progressMinutes" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "StudyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyTopicGoal" (
    "id" TEXT NOT NULL,
    "studyGoalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetMinutes" INTEGER,
    "targetQuestions" INTEGER,
    "progressMinutes" INTEGER NOT NULL DEFAULT 0,
    "progressQuestions" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyTopicGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyGoal_studentId_isCompleted_idx" ON "StudyGoal"("studentId", "isCompleted");

-- CreateIndex
CREATE INDEX "StudyTopicGoal_studyGoalId_idx" ON "StudyTopicGoal"("studyGoalId");

-- AddForeignKey
ALTER TABLE "StudyGoal" ADD CONSTRAINT "StudyGoal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyTopicGoal" ADD CONSTRAINT "StudyTopicGoal_studyGoalId_fkey" FOREIGN KEY ("studyGoalId") REFERENCES "StudyGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
