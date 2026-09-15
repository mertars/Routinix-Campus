-- AlterTable
ALTER TABLE "GuidanceProgramEntry" ADD COLUMN     "xrayAssignmentId" TEXT;

-- AlterTable
ALTER TABLE "XrayComprehensionAssignment" ADD COLUMN     "assignedByTeacherId" TEXT,
ALTER COLUMN "assignedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "GuidanceProgramEntry" ADD CONSTRAINT "GuidanceProgramEntry_xrayAssignmentId_fkey" FOREIGN KEY ("xrayAssignmentId") REFERENCES "XrayComprehensionAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XrayComprehensionAssignment" ADD CONSTRAINT "XrayComprehensionAssignment_assignedByTeacherId_fkey" FOREIGN KEY ("assignedByTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
