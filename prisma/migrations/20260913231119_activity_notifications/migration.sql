-- CreateEnum
CREATE TYPE "ActivityCategory" AS ENUM ('ATTENDANCE', 'HOMEWORK', 'EXAM', 'PAYMENT', 'STUDENT', 'SCHEDULE', 'GUIDANCE', 'CONTENT', 'ANNOUNCEMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActivityAudience" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'GUIDANCE');

-- CreateTable
CREATE TABLE "ActivityNotification" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "recipientRole" "ActivityAudience" NOT NULL,
    "recipientId" TEXT NOT NULL,
    "category" "ActivityCategory" NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "actorName" TEXT,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityNotification_recipientRole_recipientId_createdAt_idx" ON "ActivityNotification"("recipientRole", "recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityNotification_recipientRole_recipientId_isRead_idx" ON "ActivityNotification"("recipientRole", "recipientId", "isRead");

-- CreateIndex
CREATE INDEX "ActivityNotification_recipientRole_recipientId_category_idx" ON "ActivityNotification"("recipientRole", "recipientId", "category");

-- CreateIndex
CREATE INDEX "ActivityNotification_institutionId_createdAt_idx" ON "ActivityNotification"("institutionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ActivityNotification" ADD CONSTRAINT "ActivityNotification_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
