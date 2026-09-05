-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "category" TEXT;

-- CreateIndex
CREATE INDEX "Exam_institutionId_category_idx" ON "Exam"("institutionId", "category");
