-- Öğrencinin bir eğitim yılına ait kayıt dönemi + yenileme zinciri.
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'RENEWED', 'ENDED', 'LEFT');

CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "listAmount" DECIMAL(12,2),
    "installmentCount" INTEGER,
    "note" TEXT,
    "renewedToId" TEXT,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentEnrollment_renewedToId_key" ON "StudentEnrollment"("renewedToId");
CREATE UNIQUE INDEX "StudentEnrollment_studentId_academicYear_key" ON "StudentEnrollment"("studentId", "academicYear");
CREATE INDEX "StudentEnrollment_institutionId_endDate_idx" ON "StudentEnrollment"("institutionId", "endDate");
CREATE INDEX "StudentEnrollment_studentId_idx" ON "StudentEnrollment"("studentId");

ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_renewedToId_fkey" FOREIGN KEY ("renewedToId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
