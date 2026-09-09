-- CreateEnum
CREATE TYPE "TemplateModule" AS ENUM ('ANNOUNCEMENT', 'INSTALLMENT_PLAN', 'EXPENSE', 'GUIDANCE_NOTE', 'HOMEWORK', 'SCHEDULE', 'MESSAGE');

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "module" "TemplateModule" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Template_institutionId_idx" ON "Template"("institutionId");

-- CreateIndex
CREATE INDEX "Template_institutionId_module_idx" ON "Template"("institutionId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "Template_institutionId_module_name_key" ON "Template"("institutionId", "module", "name");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
