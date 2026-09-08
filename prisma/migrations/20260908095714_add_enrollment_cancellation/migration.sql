-- Kayıt iptali & iade. İade GİDER değildir (gelirin geri alınmasıdır),
-- bu yüzden ayrı bir hareket: kasa bakiyesinden düşer, gelir/gider
-- tablosunu kirletmez.
CREATE TABLE "EnrollmentCancellation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "cancelledInstallmentCount" INTEGER NOT NULL,
    "cancelledAmount" DECIMAL(12,2) NOT NULL,
    "totalPaid" DECIMAL(12,2) NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundAccountId" TEXT,
    "refundedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnrollmentCancellation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EnrollmentCancellation_institutionId_idx" ON "EnrollmentCancellation"("institutionId");
CREATE INDEX "EnrollmentCancellation_studentId_idx" ON "EnrollmentCancellation"("studentId");
ALTER TABLE "EnrollmentCancellation" ADD CONSTRAINT "EnrollmentCancellation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentCancellation" ADD CONSTRAINT "EnrollmentCancellation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentCancellation" ADD CONSTRAINT "EnrollmentCancellation_refundAccountId_fkey" FOREIGN KEY ("refundAccountId") REFERENCES "PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentCancellation" ADD CONSTRAINT "EnrollmentCancellation_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
