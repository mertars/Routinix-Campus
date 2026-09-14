-- CreateTable
CREATE TABLE "DeletedRowArchive" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "institutionId" TEXT,
    "data" JSONB NOT NULL,
    "deletedBy" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedRowArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeletedRowArchive_model_rowId_idx" ON "DeletedRowArchive"("model", "rowId");

-- CreateIndex
CREATE INDEX "DeletedRowArchive_institutionId_deletedAt_idx" ON "DeletedRowArchive"("institutionId", "deletedAt");

-- CreateIndex
CREATE INDEX "DeletedRowArchive_deletedAt_idx" ON "DeletedRowArchive"("deletedAt");
