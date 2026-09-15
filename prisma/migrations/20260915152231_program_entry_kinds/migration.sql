-- CreateEnum
CREATE TYPE "ProgramEntryKind" AS ENUM ('QUESTION', 'TOPIC_STUDY', 'VIDEO', 'XRAY_TEST');

-- AlterTable
ALTER TABLE "GuidanceProgramEntry" ADD COLUMN     "kind" "ProgramEntryKind" NOT NULL DEFAULT 'QUESTION',
ADD COLUMN     "note" TEXT,
ADD COLUMN     "subtopicId" TEXT,
ADD COLUMN     "videoId" TEXT;

-- AddForeignKey
ALTER TABLE "GuidanceProgramEntry" ADD CONSTRAINT "GuidanceProgramEntry_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;
