-- Hatalı tahsilat kaydının İPTALİ (silme değil). Tüm hesaplama sorguları
-- status='COMPLETED' filtrelediği için VOIDED kayıt bakiye/rapor/
-- yaşlandırmadan kendiliğinden düşer, denetim izi korunur.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'VOIDED';

ALTER TABLE "Payment" ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "voidReason" TEXT;
ALTER TABLE "Payment" ADD COLUMN "voidedByAdminId" TEXT;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_voidedByAdminId_fkey"
  FOREIGN KEY ("voidedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
