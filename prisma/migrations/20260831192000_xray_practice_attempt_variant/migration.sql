-- XrayPracticeAttempt: hangi havuz türünden atandığını hatırlar. Mevcut
-- gerçek denemeler yapısal olarak "genel" ile eşleştiği için geriye dönük
-- uyumlu varsayılan "genel".
ALTER TABLE "XrayPracticeAttempt" ADD COLUMN IF NOT EXISTS "variant" TEXT NOT NULL DEFAULT 'genel';
