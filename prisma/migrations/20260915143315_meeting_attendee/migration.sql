-- CreateEnum
CREATE TYPE "MeetingAttendee" AS ENUM ('STUDENT', 'PARENT', 'BOTH');

-- AlterTable
ALTER TABLE "GuidanceMeeting" ADD COLUMN     "attendee" "MeetingAttendee" NOT NULL DEFAULT 'STUDENT';
