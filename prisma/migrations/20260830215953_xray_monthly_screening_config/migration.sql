-- CreateTable
CREATE TABLE "XrayMonthlyScreeningConfig" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "subject" TEXT NOT NULL,
    "subtopicId" TEXT NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 30,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "configuredById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XrayMonthlyScreeningConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XrayMonthlyScreeningConfig_enabled_nextRunAt_idx" ON "XrayMonthlyScreeningConfig"("enabled", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "XrayMonthlyScreeningConfig_institutionId_grade_key" ON "XrayMonthlyScreeningConfig"("institutionId", "grade");

-- AddForeignKey
ALTER TABLE "XrayMonthlyScreeningConfig" ADD CONSTRAINT "XrayMonthlyScreeningConfig_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayMonthlyScreeningConfig" ADD CONSTRAINT "XrayMonthlyScreeningConfig_configuredById_fkey" FOREIGN KEY ("configuredById") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
