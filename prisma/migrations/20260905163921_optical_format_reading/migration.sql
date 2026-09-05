-- AlterTable
ALTER TABLE "ExamQuestion" ADD COLUMN     "correctAnswer" TEXT;

-- CreateTable
CREATE TABLE "OpticalFormat" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tcNoStart" INTEGER,
    "tcNoLength" INTEGER,
    "studentNoStart" INTEGER,
    "studentNoLength" INTEGER,
    "bookletStart" INTEGER,
    "bookletLength" INTEGER,
    "gradeStart" INTEGER,
    "gradeLength" INTEGER,
    "branchStart" INTEGER,
    "branchLength" INTEGER,
    "nameStart" INTEGER,
    "nameLength" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpticalFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpticalSubjectBlock" (
    "id" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "length" INTEGER NOT NULL,

    CONSTRAINT "OpticalSubjectBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpticalFormat_institutionId_idx" ON "OpticalFormat"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "OpticalFormat_institutionId_name_key" ON "OpticalFormat"("institutionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "OpticalSubjectBlock_formatId_subject_key" ON "OpticalSubjectBlock"("formatId", "subject");

-- AddForeignKey
ALTER TABLE "OpticalFormat" ADD CONSTRAINT "OpticalFormat_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpticalSubjectBlock" ADD CONSTRAINT "OpticalSubjectBlock_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "OpticalFormat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
