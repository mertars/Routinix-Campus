-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "opticalFormatId" TEXT;

-- AlterTable
ALTER TABLE "OpticalSubjectBlock" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_opticalFormatId_fkey" FOREIGN KEY ("opticalFormatId") REFERENCES "OpticalFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
