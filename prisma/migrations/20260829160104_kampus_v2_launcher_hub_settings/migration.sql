-- CreateEnum
CREATE TYPE "GuidanceReferralStatus" AS ENUM ('PENDING', 'REVIEWED');

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "smsCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "smsProviderKey" TEXT;

-- CreateTable
CREATE TABLE "InstitutionSettings" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "isEtutAdminManaged" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionSmsTemplate" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionSmsTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidanceReferral" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "GuidanceReferralStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuidanceReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionSettings_institutionId_key" ON "InstitutionSettings"("institutionId");

-- CreateIndex
CREATE INDEX "InstitutionSmsTemplate_institutionId_idx" ON "InstitutionSmsTemplate"("institutionId");

-- CreateIndex
CREATE INDEX "GuidanceReferral_studentId_idx" ON "GuidanceReferral"("studentId");

-- CreateIndex
CREATE INDEX "GuidanceReferral_teacherId_idx" ON "GuidanceReferral"("teacherId");

-- AddForeignKey
ALTER TABLE "InstitutionSettings" ADD CONSTRAINT "InstitutionSettings_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionSmsTemplate" ADD CONSTRAINT "InstitutionSmsTemplate_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidanceReferral" ADD CONSTRAINT "GuidanceReferral_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidanceReferral" ADD CONSTRAINT "GuidanceReferral_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
