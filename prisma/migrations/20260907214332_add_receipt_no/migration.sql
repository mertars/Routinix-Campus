-- Makbuz numarası: kurum içinde artan sıra. Nullable — modül öncesinden
-- kalan tahsilatların numarası yoktur, ilk makbuz basımında atanır.
ALTER TABLE "Payment" ADD COLUMN "receiptNo" INTEGER;

-- NULL'lar Postgres'te çakışmaz; bu istenen davranış (numarasız yüzlerce
-- eski kayıt sorun çıkarmaz, ama aynı numara aynı kurumda iki kez kullanılamaz).
CREATE UNIQUE INDEX "Payment_institutionId_receiptNo_key" ON "Payment"("institutionId", "receiptNo");
