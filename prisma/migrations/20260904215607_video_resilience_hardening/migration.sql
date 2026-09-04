-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "failureReason" TEXT,
ALTER COLUMN "youtubeId" DROP NOT NULL;
