/*
  Warnings:

  - You are about to drop the column `durationSeconds` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `r2Key` on the `Video` table. All the data in the column will be lost.
  - Added the required column `youtubeId` to the `Video` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Video" DROP COLUMN "durationSeconds",
DROP COLUMN "r2Key",
ADD COLUMN     "youtubeId" TEXT NOT NULL;
