-- CreateTable
CREATE TABLE "XrayQaReviewControl" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "paused" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XrayQaReviewControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XrayQaReviewedRound" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "issuesFound" INTEGER NOT NULL DEFAULT 0,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XrayQaReviewedRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XrayQaFinding" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "soruNo" INTEGER NOT NULL,
    "kazanimId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "beforePrompt" TEXT NOT NULL,
    "beforeCorrectAnswer" TEXT NOT NULL,
    "beforeSolution" TEXT NOT NULL,
    "beforeChecks" TEXT NOT NULL,
    "afterPrompt" TEXT,
    "afterCorrectAnswer" TEXT,
    "afterSolution" TEXT,
    "afterChecks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "relatedFindingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fixedAt" TIMESTAMP(3),

    CONSTRAINT "XrayQaFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "XrayQaReviewedRound_testId_key" ON "XrayQaReviewedRound"("testId");

-- CreateIndex
CREATE INDEX "XrayQaReviewedRound_subject_idx" ON "XrayQaReviewedRound"("subject");

-- CreateIndex
CREATE INDEX "XrayQaFinding_subject_status_idx" ON "XrayQaFinding"("subject", "status");

-- CreateIndex
CREATE INDEX "XrayQaFinding_testId_idx" ON "XrayQaFinding"("testId");

-- CreateIndex
CREATE INDEX "XrayQaFinding_kazanimId_idx" ON "XrayQaFinding"("kazanimId");

-- CreateIndex
CREATE INDEX "XrayQaFinding_relatedFindingId_idx" ON "XrayQaFinding"("relatedFindingId");
