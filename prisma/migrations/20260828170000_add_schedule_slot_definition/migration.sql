-- CreateTable
CREATE TABLE "ScheduleSlotDefinition" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleSlotDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleSlotDefinition_institutionId_idx" ON "ScheduleSlotDefinition"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleSlotDefinition_institutionId_label_key" ON "ScheduleSlotDefinition"("institutionId", "label");

-- AddForeignKey
ALTER TABLE "ScheduleSlotDefinition" ADD CONSTRAINT "ScheduleSlotDefinition_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Geriye dönük veri taşıma: eski sabit SCHEDULE_SLOTS listesi (lib/mock-data.ts)
-- her kurum için varsayılan olsun ki admin sıfırdan başlayan boş bir saat
-- listesiyle karşılaşmasın.
INSERT INTO "ScheduleSlotDefinition" ("id", "institutionId", "label", "createdAt")
SELECT gen_random_uuid()::text, i."id", label, CURRENT_TIMESTAMP
FROM "Institution" i, unnest(ARRAY['16:00-17:00', '17:00-18:00', '18:00-19:00', '19:00-20:00']) AS label
ON CONFLICT ("institutionId", "label") DO NOTHING;

-- Mevcut LessonSlot kayıtlarının kullandığı, varsayılan 4 saatin DIŞINDAKİ
-- saatleri de ekle — aksi halde o saatlere atanmış gerçek dersler yönetici
-- panelinde "tanımsız" bir saat dilimine düşüp görünmez olurdu.
INSERT INTO "ScheduleSlotDefinition" ("id", "institutionId", "label", "createdAt")
SELECT DISTINCT gen_random_uuid()::text, b."institutionId", ls."slot", CURRENT_TIMESTAMP
FROM "LessonSlot" ls
JOIN "Branch" b ON b."id" = ls."branchId"
ON CONFLICT ("institutionId", "label") DO NOTHING;
