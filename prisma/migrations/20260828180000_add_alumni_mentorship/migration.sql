-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ALUMNI_PROFILE_CREATED';

-- CreateTable
CREATE TABLE "AlumniProfile" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "graduationYear" INTEGER NOT NULL,
    "highSchoolRank" TEXT,
    "admittedTo" TEXT NOT NULL,
    "examScope" TEXT NOT NULL,
    "isMentor" BOOLEAN NOT NULL DEFAULT false,
    "mentorNote" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorRequest" (
    "id" TEXT NOT NULL,
    "alumniProfileId" TEXT NOT NULL,
    "requesterStudentId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "MentorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlumniProfile_studentId_key" ON "AlumniProfile"("studentId");

-- CreateIndex
CREATE INDEX "AlumniProfile_studentId_idx" ON "AlumniProfile"("studentId");

-- CreateIndex
CREATE INDEX "MentorRequest_alumniProfileId_idx" ON "MentorRequest"("alumniProfileId");

-- CreateIndex
CREATE INDEX "MentorRequest_requesterStudentId_idx" ON "MentorRequest"("requesterStudentId");

-- AddForeignKey
ALTER TABLE "AlumniProfile" ADD CONSTRAINT "AlumniProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorRequest" ADD CONSTRAINT "MentorRequest_alumniProfileId_fkey" FOREIGN KEY ("alumniProfileId") REFERENCES "AlumniProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorRequest" ADD CONSTRAINT "MentorRequest_requesterStudentId_fkey" FOREIGN KEY ("requesterStudentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
