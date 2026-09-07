-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('SIBLING', 'MERIT', 'EARLY_REGISTRATION', 'STAFF_CHILD', 'FINANCIAL_AID', 'OTHER');

-- CreateEnum
CREATE TYPE "DiscountValueType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateTable
CREATE TABLE "StudentDiscount" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "valueType" "DiscountValueType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "academicYear" TEXT NOT NULL,
    "reason" TEXT,
    "appliedListAmount" DECIMAL(12,2),
    "appliedDiscount" DECIMAL(12,2),
    "appliedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvedByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentDiscount_institutionId_idx" ON "StudentDiscount"("institutionId");

-- CreateIndex
CREATE INDEX "StudentDiscount_studentId_idx" ON "StudentDiscount"("studentId");

-- AddForeignKey
ALTER TABLE "StudentDiscount" ADD CONSTRAINT "StudentDiscount_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDiscount" ADD CONSTRAINT "StudentDiscount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDiscount" ADD CONSTRAINT "StudentDiscount_approvedByAdminId_fkey" FOREIGN KEY ("approvedByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
