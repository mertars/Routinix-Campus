-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "grade" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoAssignment" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "watchedAt" TIMESTAMP(3),

    CONSTRAINT "VideoAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Video_institutionId_grade_subject_idx" ON "Video"("institutionId", "grade", "subject");

-- CreateIndex
CREATE INDEX "VideoAssignment_studentId_idx" ON "VideoAssignment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoAssignment_videoId_studentId_key" ON "VideoAssignment"("videoId", "studentId");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAssignment" ADD CONSTRAINT "VideoAssignment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAssignment" ADD CONSTRAINT "VideoAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
