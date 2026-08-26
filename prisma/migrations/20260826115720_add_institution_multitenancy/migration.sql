-- Çoklu-kurum (SaaS) temeli: Institution tablosu + 8 kök modelde institutionId.
-- Elle düzenlendi (prisma migrate diff otomatik üretimi NOT NULL kolonu doğrudan
-- eklemeye çalışıyordu — dolu tablolarda bu başarısız olur). Güvenli sıra:
-- (1) Institution tablosunu oluştur, (2) mevcut TEK kurumu ekle,
-- (3) institutionId'yi NULLABLE olarak ekle, (4) tüm mevcut satırları geriye
-- doğru doldur (backfill), (5) NOT NULL uygula, (6) global unique index'leri
-- kurum-bazlı composite unique ile değiştir, (7) FK'leri ekle.
-- Tek işlemde (transaction) çalışır: tüm adımlar ya birlikte uygulanır ya da
-- hiçbiri uygulanmaz.

BEGIN;

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Institution_slug_key" ON "Institution"("slug");

-- Mevcut sistemdeki TEK kurumu ekle — tüm mevcut kayıtlar buna bağlanacak.
INSERT INTO "Institution" ("id", "name", "slug", "isActive", "createdAt", "updatedAt")
VALUES ('inst_arslan_dershaneleri_default', 'Arslan Dershaneleri', 'arslan-dershaneleri', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable: önce NULLABLE ekle (dolu tablolarda NOT NULL doğrudan eklenemez)
ALTER TABLE "Admin" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "Announcement" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "Branch" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "Exam" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "NotificationBatch" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "Parent" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "Student" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "Teacher" ADD COLUMN "institutionId" TEXT;

-- Backfill: mevcut her satır tek kurum olan "Arslan Dershaneleri"ne bağlanır.
UPDATE "Admin" SET "institutionId" = 'inst_arslan_dershaneleri_default';
UPDATE "Announcement" SET "institutionId" = 'inst_arslan_dershaneleri_default';
UPDATE "Branch" SET "institutionId" = 'inst_arslan_dershaneleri_default';
UPDATE "Exam" SET "institutionId" = 'inst_arslan_dershaneleri_default';
UPDATE "NotificationBatch" SET "institutionId" = 'inst_arslan_dershaneleri_default';
UPDATE "Parent" SET "institutionId" = 'inst_arslan_dershaneleri_default';
UPDATE "Student" SET "institutionId" = 'inst_arslan_dershaneleri_default';
UPDATE "Teacher" SET "institutionId" = 'inst_arslan_dershaneleri_default';

-- Artık her satır doldu — NOT NULL uygula.
ALTER TABLE "Admin" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "Announcement" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "Branch" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "Exam" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "NotificationBatch" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "Parent" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "Student" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "Teacher" ALTER COLUMN "institutionId" SET NOT NULL;

-- DropIndex: eski global-unique kısıtları kaldır (kurum-bazlı olanlarla değişecek)
DROP INDEX "Branch_institutionalCode_key";
DROP INDEX "Branch_name_key";
DROP INDEX "Student_studentNumber_key";
DROP INDEX "Teacher_institutionalCode_key";

-- CreateIndex
CREATE INDEX "Admin_institutionId_idx" ON "Admin"("institutionId");
CREATE INDEX "Announcement_institutionId_idx" ON "Announcement"("institutionId");
CREATE INDEX "Branch_institutionId_idx" ON "Branch"("institutionId");
CREATE UNIQUE INDEX "Branch_institutionId_name_key" ON "Branch"("institutionId", "name");
CREATE UNIQUE INDEX "Branch_institutionId_institutionalCode_key" ON "Branch"("institutionId", "institutionalCode");
CREATE INDEX "Exam_institutionId_idx" ON "Exam"("institutionId");
CREATE INDEX "NotificationBatch_institutionId_idx" ON "NotificationBatch"("institutionId");
CREATE INDEX "Parent_institutionId_idx" ON "Parent"("institutionId");
CREATE INDEX "Student_institutionId_idx" ON "Student"("institutionId");
CREATE UNIQUE INDEX "Student_institutionId_studentNumber_key" ON "Student"("institutionId", "studentNumber");
CREATE INDEX "Teacher_institutionId_idx" ON "Teacher"("institutionId");
CREATE UNIQUE INDEX "Teacher_institutionId_institutionalCode_key" ON "Teacher"("institutionId", "institutionalCode");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Parent" ADD CONSTRAINT "Parent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationBatch" ADD CONSTRAINT "NotificationBatch_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
