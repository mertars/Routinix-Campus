-- DropIndex
DROP INDEX "AttendanceRecord_studentId_date_key";

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "slot" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "subject" TEXT NOT NULL DEFAULT 'Genel';

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_studentId_date_slot_key" ON "AttendanceRecord"("studentId", "date", "slot");
