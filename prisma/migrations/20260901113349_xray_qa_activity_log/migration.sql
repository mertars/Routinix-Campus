-- CreateTable
CREATE TABLE "XrayQaActivityLog" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XrayQaActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XrayQaActivityLog_subject_createdAt_idx" ON "XrayQaActivityLog"("subject", "createdAt");
