-- CreateTable
CREATE TABLE "XrayPoolQaIssueLog" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "soruNo" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XrayPoolQaIssueLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XrayPoolQaIssueLog_subject_variant_unitId_idx" ON "XrayPoolQaIssueLog"("subject", "variant", "unitId");

-- CreateIndex
CREATE INDEX "XrayPoolQaIssueLog_source_idx" ON "XrayPoolQaIssueLog"("source");
