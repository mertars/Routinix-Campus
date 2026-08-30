-- CreateTable
CREATE TABLE "XrayMasteryGoal" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subtopicId" TEXT NOT NULL,
    "targetScore" INTEGER NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "achievedAt" TIMESTAMP(3),

    CONSTRAINT "XrayMasteryGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XrayMasteryGoal_studentId_achievedAt_idx" ON "XrayMasteryGoal"("studentId", "achievedAt");

-- AddForeignKey
ALTER TABLE "XrayMasteryGoal" ADD CONSTRAINT "XrayMasteryGoal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
