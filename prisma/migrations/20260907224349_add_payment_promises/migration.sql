-- Ödeme sözü. Durum saklanmaz, okuma anında hesaplanır (bkz. promises route).
CREATE TABLE "PaymentPromise" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "promisedAmount" DECIMAL(12,2) NOT NULL,
    "promisedDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentPromise_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentPromise_institutionId_idx" ON "PaymentPromise"("institutionId");
CREATE INDEX "PaymentPromise_studentId_idx" ON "PaymentPromise"("studentId");
ALTER TABLE "PaymentPromise" ADD CONSTRAINT "PaymentPromise_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentPromise" ADD CONSTRAINT "PaymentPromise_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentPromise" ADD CONSTRAINT "PaymentPromise_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
