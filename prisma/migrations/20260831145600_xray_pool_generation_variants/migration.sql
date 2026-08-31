-- XrayPracticeQuestion: 3 havuz türünü ("genel"/"alt_konu"/"yeterlilik")
-- ayırt eden variant kolonu. Mevcut 30 gerçek İntegral sorusu 30 sorulu/
-- banded yapısı itibariyle "genel" ile eşleşiyor, bu yüzden geriye dönük
-- uyumlu varsayılan olarak "genel" kullanılıyor.
ALTER TABLE "XrayPracticeQuestion" ADD COLUMN IF NOT EXISTS "variant" TEXT NOT NULL DEFAULT 'genel';
CREATE INDEX IF NOT EXISTS "XrayPracticeQuestion_subject_variant_idx" ON "XrayPracticeQuestion"("subject", "variant");

-- XrayPoolGenerationRound: bu tablo tamamen BOŞ (worker henüz hiçbir turu
-- başarıyla tamamlamadı) — veri kaybı riski olmadan subtopicId'yi genel
-- amaçlı unitId'ye dönüştürüp variant ekliyoruz. Prisma'nın @@unique/@@index
-- ürettiği bu isimler CONSTRAINT değil, sıradan UNIQUE/INDEX'tir — DROP INDEX
-- kullanılıyor (önceki denemedeki DROP CONSTRAINT hatası buradan kaynaklandı).
DROP INDEX IF EXISTS "XrayPoolGenerationRound_subject_subtopicId_idx";
DROP INDEX IF EXISTS "XrayPoolGenerationRound_subject_subtopicId_roundNumber_key";
ALTER TABLE "XrayPoolGenerationRound" RENAME COLUMN "subtopicId" TO "unitId";
ALTER TABLE "XrayPoolGenerationRound" ADD COLUMN IF NOT EXISTS "variant" TEXT NOT NULL DEFAULT 'genel';
ALTER TABLE "XrayPoolGenerationRound" ALTER COLUMN "variant" DROP DEFAULT;
CREATE INDEX IF NOT EXISTS "XrayPoolGenerationRound_subject_variant_unitId_idx" ON "XrayPoolGenerationRound"("subject", "variant", "unitId");
CREATE UNIQUE INDEX IF NOT EXISTS "XrayPoolGenerationRound_subject_variant_unitId_roundNumber_key" ON "XrayPoolGenerationRound"("subject", "variant", "unitId", "roundNumber");

-- XrayPoolGenerationControl: worker'ın sırayla (round-robin) işleyeceği
-- aktif variant listesi.
ALTER TABLE "XrayPoolGenerationControl" ADD COLUMN IF NOT EXISTS "activeVariants" JSONB NOT NULL DEFAULT '["genel"]';
