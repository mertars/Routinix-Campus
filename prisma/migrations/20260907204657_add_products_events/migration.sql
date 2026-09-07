-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PRODUCT', 'EVENT');

-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "productId" TEXT;

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "eventDate" TIMESTAMP(3),
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_institutionId_idx" ON "Product"("institutionId");

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
