-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "status" "VideoStatus" NOT NULL DEFAULT 'PROCESSING';
