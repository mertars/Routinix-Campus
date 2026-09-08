-- Ödeme modülü yetki seviyesi. Varsayılan FULL: mevcut kurumlarda hiçbir
-- yöneticinin erişimi sessizce kesilmesin (kısıtlama bilerek uygulanır).
CREATE TYPE "PaymentRole" AS ENUM ('NONE', 'COLLECTOR', 'FULL');
ALTER TABLE "Admin" ADD COLUMN "paymentRole" "PaymentRole" NOT NULL DEFAULT 'FULL';

-- Yeni denetim eylemleri
ALTER TYPE "AuditAction" ADD VALUE 'CASH_COUNTED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_ROLE_CHANGED';

-- Gün sonu kasa sayımı
CREATE TABLE "CashCount" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "systemBalance" DECIMAL(12,2) NOT NULL,
    "countedAmount" DECIMAL(12,2) NOT NULL,
    "difference" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashCount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashCount_institutionId_countedAt_idx" ON "CashCount"("institutionId", "countedAt");
CREATE INDEX "CashCount_accountId_idx" ON "CashCount"("accountId");

ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashCount" ADD CONSTRAINT "CashCount_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Otomatik hatırlatma kuralı (kurum başına tek kayıt)
CREATE TABLE "ReminderRule" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "daysBefore" INTEGER NOT NULL DEFAULT 3,
    "beforeTemplate" TEXT NOT NULL,
    "daysAfter" INTEGER NOT NULL DEFAULT 3,
    "afterTemplate" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastSentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReminderRule_institutionId_key" ON "ReminderRule"("institutionId");
ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
