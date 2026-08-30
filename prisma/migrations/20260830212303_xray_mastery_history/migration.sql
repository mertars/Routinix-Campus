-- CreateTable
CREATE TABLE "TopicMasteryHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subtopicId" TEXT NOT NULL,
    "masteryScore" INTEGER NOT NULL,
    "source" "XraySource" NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicMasteryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopicMasteryHistory_studentId_subtopicId_assessedAt_idx" ON "TopicMasteryHistory"("studentId", "subtopicId", "assessedAt");

-- AddForeignKey
ALTER TABLE "TopicMasteryHistory" ADD CONSTRAINT "TopicMasteryHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
