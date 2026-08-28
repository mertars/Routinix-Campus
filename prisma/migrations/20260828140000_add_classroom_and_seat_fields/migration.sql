-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Classroom_institutionId_idx" ON "Classroom"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_institutionId_name_key" ON "Classroom"("institutionId", "name");

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ExamSeatAssignment" ADD COLUMN "classroomId" TEXT,
ADD COLUMN "deskId" TEXT;

-- CreateIndex
CREATE INDEX "ExamSeatAssignment_classroomId_idx" ON "ExamSeatAssignment"("classroomId");

-- AddForeignKey
ALTER TABLE "ExamSeatAssignment" ADD CONSTRAINT "ExamSeatAssignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
