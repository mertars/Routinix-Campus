/*
  Warnings:

  - You are about to drop the column `category` on the `Exam` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ExamCategoryKind" AS ENUM ('STANDARD', 'YKS_PAIR');

-- DropIndex
DROP INDEX "Exam_institutionId_category_idx";

-- AlterTable
ALTER TABLE "Exam" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "InstitutionSettings" ADD COLUMN     "examCategoriesSeeded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ExamCategory" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" "ExamCategoryKind" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamGroup" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamCategory_institutionId_idx" ON "ExamCategory"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamCategory_institutionId_name_key" ON "ExamCategory"("institutionId", "name");

-- CreateIndex
CREATE INDEX "ExamGroup_institutionId_idx" ON "ExamGroup"("institutionId");

-- CreateIndex
CREATE INDEX "Exam_institutionId_categoryId_idx" ON "Exam"("institutionId", "categoryId");

-- CreateIndex
CREATE INDEX "Exam_groupId_idx" ON "Exam"("groupId");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExamCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ExamGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamCategory" ADD CONSTRAINT "ExamCategory_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamGroup" ADD CONSTRAINT "ExamGroup_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
