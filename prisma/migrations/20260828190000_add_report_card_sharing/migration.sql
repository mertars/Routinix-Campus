-- CreateTable
CREATE TABLE "ReportCardShareLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportCardShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCardTeacherComment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCardTeacherComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardShareLink_token_key" ON "ReportCardShareLink"("token");

-- CreateIndex
CREATE INDEX "ReportCardShareLink_studentId_idx" ON "ReportCardShareLink"("studentId");

-- CreateIndex
CREATE INDEX "ReportCardTeacherComment_studentId_idx" ON "ReportCardTeacherComment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardTeacherComment_studentId_periodLabel_key" ON "ReportCardTeacherComment"("studentId", "periodLabel");

-- AddForeignKey
ALTER TABLE "ReportCardShareLink" ADD CONSTRAINT "ReportCardShareLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardTeacherComment" ADD CONSTRAINT "ReportCardTeacherComment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardTeacherComment" ADD CONSTRAINT "ReportCardTeacherComment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
