-- CreateEnum
CREATE TYPE "GuidanceMeetingStatus" AS ENUM ('PLANNED', 'DONE', 'NO_SHOW', 'CANCELLED');

-- CreateTable
CREATE TABLE "GuidanceMeeting" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "counselorId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "topic" TEXT NOT NULL,
    "category" "GuidanceCategory" NOT NULL DEFAULT 'ACADEMIC',
    "status" "GuidanceMeetingStatus" NOT NULL DEFAULT 'PLANNED',
    "outcomeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuidanceMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuidanceMeeting_counselorId_scheduledAt_idx" ON "GuidanceMeeting"("counselorId", "scheduledAt");

-- CreateIndex
CREATE INDEX "GuidanceMeeting_studentId_idx" ON "GuidanceMeeting"("studentId");

-- AddForeignKey
ALTER TABLE "GuidanceMeeting" ADD CONSTRAINT "GuidanceMeeting_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidanceMeeting" ADD CONSTRAINT "GuidanceMeeting_counselorId_fkey" FOREIGN KEY ("counselorId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
