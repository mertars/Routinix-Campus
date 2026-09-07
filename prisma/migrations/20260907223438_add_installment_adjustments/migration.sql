-- Taksit erteleme / yapılandırma denetim izi.
CREATE TYPE "InstallmentAdjustmentType" AS ENUM ('POSTPONE', 'RESTRUCTURE');

CREATE TABLE "InstallmentAdjustment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "installmentId" TEXT,
    "type" "InstallmentAdjustmentType" NOT NULL,
    "previousDueDate" TIMESTAMP(3),
    "newDueDate" TIMESTAMP(3),
    "affectedCount" INTEGER,
    "amount" DECIMAL(12,2),
    "reason" TEXT NOT NULL,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstallmentAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstallmentAdjustment_institutionId_idx" ON "InstallmentAdjustment"("institutionId");
CREATE INDEX "InstallmentAdjustment_studentId_idx" ON "InstallmentAdjustment"("studentId");

ALTER TABLE "InstallmentAdjustment" ADD CONSTRAINT "InstallmentAdjustment_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstallmentAdjustment" ADD CONSTRAINT "InstallmentAdjustment_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstallmentAdjustment" ADD CONSTRAINT "InstallmentAdjustment_installmentId_fkey"
  FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstallmentAdjustment" ADD CONSTRAINT "InstallmentAdjustment_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
