-- CreateTable
CREATE TABLE "XrayPoolGenerationRound" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subtopicId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "blueprint" JSONB,
    "testId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XrayPoolGenerationRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XrayPoolGenerationControl" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "paused" BOOLEAN NOT NULL DEFAULT true,
    "dailyTokenBudget" INTEGER NOT NULL DEFAULT 15000000,
    "tokensUsedToday" INTEGER NOT NULL DEFAULT 0,
    "tokensUsedTotal" INTEGER NOT NULL DEFAULT 0,
    "budgetResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XrayPoolGenerationControl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XrayPoolGenerationRound_subject_subtopicId_idx" ON "XrayPoolGenerationRound"("subject", "subtopicId");

-- CreateIndex
CREATE INDEX "XrayPoolGenerationRound_status_idx" ON "XrayPoolGenerationRound"("status");

-- CreateIndex
CREATE UNIQUE INDEX "XrayPoolGenerationRound_subject_subtopicId_roundNumber_key" ON "XrayPoolGenerationRound"("subject", "subtopicId", "roundNumber");
