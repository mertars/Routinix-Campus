-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN "etutBreakMinutes" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "EtutSetting" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 20,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtutSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherEtutAvailability" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherEtutAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EtutSetting_institutionId_key" ON "EtutSetting"("institutionId");

-- CreateIndex
CREATE INDEX "TeacherEtutAvailability_teacherId_day_idx" ON "TeacherEtutAvailability"("teacherId", "day");

-- AddForeignKey
ALTER TABLE "EtutSetting" ADD CONSTRAINT "EtutSetting_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEtutAvailability" ADD CONSTRAINT "TeacherEtutAvailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
