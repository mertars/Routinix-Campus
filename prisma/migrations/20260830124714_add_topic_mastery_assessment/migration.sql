-- CreateTable
CREATE TABLE "TopicMasteryAssessment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subtopicId" TEXT NOT NULL,
    "masteryScore" INTEGER NOT NULL,
    "note" TEXT,
    "assessedById" TEXT NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicMasteryAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopicMasteryAssessment_studentId_idx" ON "TopicMasteryAssessment"("studentId");

-- CreateIndex
CREATE INDEX "TopicMasteryAssessment_assessedById_idx" ON "TopicMasteryAssessment"("assessedById");

-- CreateIndex
CREATE UNIQUE INDEX "TopicMasteryAssessment_studentId_subtopicId_key" ON "TopicMasteryAssessment"("studentId", "subtopicId");

-- AddForeignKey
ALTER TABLE "TopicMasteryAssessment" ADD CONSTRAINT "TopicMasteryAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicMasteryAssessment" ADD CONSTRAINT "TopicMasteryAssessment_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
