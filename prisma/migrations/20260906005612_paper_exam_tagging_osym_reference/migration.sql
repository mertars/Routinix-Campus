-- AlterTable
ALTER TABLE "ExamNetResult" ADD COLUMN     "answerLetters" TEXT;

-- AlterTable
ALTER TABLE "TopicMasteryHistory" ADD COLUMN     "sourceSessionId" TEXT;

-- CreateTable
CREATE TABLE "OsymReferenceTable" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "puanTuru" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OsymReferenceTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OsymReferenceRow" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "net" DOUBLE PRECISION NOT NULL,
    "ranking" INTEGER NOT NULL,

    CONSTRAINT "OsymReferenceRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OsymReferenceTable_institutionId_idx" ON "OsymReferenceTable"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "OsymReferenceTable_institutionId_name_key" ON "OsymReferenceTable"("institutionId", "name");

-- CreateIndex
CREATE INDEX "OsymReferenceRow_tableId_net_idx" ON "OsymReferenceRow"("tableId", "net");

-- AddForeignKey
ALTER TABLE "OsymReferenceTable" ADD CONSTRAINT "OsymReferenceTable_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OsymReferenceRow" ADD CONSTRAINT "OsymReferenceRow_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "OsymReferenceTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
