-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AdminAuthorityLevel" AS ENUM ('SUPER_ADMIN', 'BRANCH_MANAGER', 'COORDINATOR');

-- CreateEnum
CREATE TYPE "public"."AnnouncementAuthorRole" AS ENUM ('ADMIN', 'TEACHER');

-- CreateEnum
CREATE TYPE "public"."AnnouncementCategory" AS ENUM ('GENERAL', 'EXAM', 'HOLIDAY', 'EVENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "public"."AppointmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."BloodType" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."BranchSegment" AS ENUM ('LGS', 'YKS', 'MEZUN');

-- CreateEnum
CREATE TYPE "public"."ConfidentialityLevel" AS ENUM ('PUBLIC', 'RESTRICTED', 'CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "public"."ConsentStatus" AS ENUM ('GRANTED', 'DENIED', 'PENDING');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('FEMALE', 'MALE');

-- CreateEnum
CREATE TYPE "public"."GuidanceCategory" AS ENUM ('ACADEMIC', 'PSYCHOLOGICAL', 'DISCIPLINARY');

-- CreateEnum
CREATE TYPE "public"."HomeworkStatus" AS ENUM ('NOT_DONE', 'HALF', 'DONE', 'LATE');

-- CreateEnum
CREATE TYPE "public"."NotificationScopeType" AS ENUM ('ALL_SCHOOL', 'GRADE', 'BRANCH', 'CUSTOM_GROUP', 'CUSTOM_ID_LIST');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."OtpPurpose" AS ENUM ('FIRST_LOGIN', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "public"."ParentRelationship" AS ENUM ('MOTHER', 'FATHER', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "public"."QuestionStatus" AS ENUM ('PENDING', 'ANSWERED', 'SOLVED');

-- CreateEnum
CREATE TYPE "public"."QuizStage" AS ENUM ('LIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "public"."TransportMethod" AS ENUM ('SCHOOL_SERVICE', 'PRIVATE_VEHICLE', 'PUBLIC_TRANSPORT', 'WALKING');

-- CreateTable
CREATE TABLE "public"."Admin" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorityLevel" "public"."AdminAuthorityLevel" NOT NULL DEFAULT 'BRANCH_MANAGER',
    "institutionalMobile" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "extensionNumber" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "public"."AnnouncementCategory" NOT NULL DEFAULT 'GENERAL',
    "scopeType" "public"."NotificationScopeType" NOT NULL DEFAULT 'ALL_SCHOOL',
    "scopeValue" TEXT,
    "authorName" TEXT NOT NULL,
    "authorRole" "public"."AnnouncementAuthorRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppointmentRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "status" "public"."AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "AppointmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendanceRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendanceSubmission" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "segment" "public"."BranchSegment" NOT NULL DEFAULT 'YKS',
    "institutionalCode" TEXT,
    "track" TEXT,
    "advisorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClassbookNote" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassbookNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CurriculumProgress" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subtopicId" TEXT NOT NULL,
    "covered" BOOLEAN NOT NULL DEFAULT false,
    "coveredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Exam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExamNetResult" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "net" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamNetResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExamSeatAssignment" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "hall" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "rowNum" INTEGER NOT NULL,
    "colNum" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamSeatAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuidanceNote" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "category" "public"."GuidanceCategory" NOT NULL DEFAULT 'ACADEMIC',
    "confidentialityLevel" "public"."ConfidentialityLevel" NOT NULL DEFAULT 'RESTRICTED',
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuidanceNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuidanceProgram" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "weekLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuidanceProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuidanceProgramEntry" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "questionTarget" INTEGER NOT NULL,

    CONSTRAINT "GuidanceProgramEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Homework" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "branchIds" TEXT[],
    "title" TEXT NOT NULL,
    "description" TEXT,
    "linkUrl" TEXT,
    "fileNames" TEXT[],
    "checklist" TEXT[],
    "targetQuestionCount" INTEGER,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HomeworkSubmission" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "public"."HomeworkStatus" NOT NULL DEFAULT 'NOT_DONE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LessonSlot" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "slot" TEXT NOT NULL,

    CONSTRAINT "LessonSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LoginAttempt" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationBatch" (
    "id" TEXT NOT NULL,
    "scopeType" "public"."NotificationScopeType" NOT NULL,
    "scopeValue" TEXT,
    "templateId" TEXT,
    "rawMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationLog" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "recipientName" TEXT,
    "message" TEXT NOT NULL,
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "providerName" TEXT,
    "providerRef" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "public"."OtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Parent" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "relationship" "public"."ParentRelationship" NOT NULL,
    "mobilePhone" TEXT NOT NULL,
    "smsConsent" BOOLEAN NOT NULL DEFAULT false,
    "workPhone" TEXT,
    "email" TEXT,
    "homeAddress" TEXT,
    "workAddress" TEXT,
    "occupation" TEXT,
    "company" TEXT,
    "title" TEXT,
    "kvkkConsent" "public"."ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "iysConsent" "public"."ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ParentStudent" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "ParentStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Question" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "studentNote" TEXT,
    "status" "public"."QuestionStatus" NOT NULL DEFAULT 'PENDING',
    "answerText" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Quiz" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "stage" "public"."QuizStage" NOT NULL DEFAULT 'LIVE',
    "launchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuizBankQuestion" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "imageLabel" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizBankQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "imageLabel" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuizSubmission" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "correct" INTEGER NOT NULL,
    "wrong" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RemediationTask" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "taskDescription" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemediationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReportCard" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SeatingArrangement" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentOrder" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatingArrangement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SmsTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Student" (
    "id" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "gender" "public"."Gender",
    "bloodType" "public"."BloodType" NOT NULL DEFAULT 'UNKNOWN',
    "studentNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "track" TEXT,
    "advisorTeacherId" TEXT,
    "transportMethod" "public"."TransportMethod",
    "residenceAddress" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "healthNote" TEXT,
    "targetNet" DOUBLE PRECISION,
    "weeklyStudyHours" INTEGER,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudentPreference" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Teacher" (
    "id" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "university" TEXT,
    "mobilePhone" TEXT NOT NULL,
    "institutionalEmail" TEXT,
    "personalEmail" TEXT,
    "dutyDays" TEXT[],
    "institutionalCode" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TeacherDutySlot" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "TeacherDutySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TeacherMaterial" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "sizeLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TeacherUnavailability" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "slot" TEXT NOT NULL,

    CONSTRAINT "TeacherUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."YearlyPlanRow" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "weekLabel" TEXT NOT NULL,
    "subtopicName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YearlyPlanRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_BranchTeaching" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BranchTeaching_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_studentId_key" ON "public"."AnnouncementRead"("announcementId" ASC, "studentId" ASC);

-- CreateIndex
CREATE INDEX "AppointmentRequest_studentId_idx" ON "public"."AppointmentRequest"("studentId" ASC);

-- CreateIndex
CREATE INDEX "AppointmentRequest_teacherId_idx" ON "public"."AppointmentRequest"("teacherId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_studentId_date_key" ON "public"."AttendanceRecord"("studentId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "AttendanceSubmission_branchId_idx" ON "public"."AttendanceSubmission"("branchId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_institutionalCode_key" ON "public"."Branch"("institutionalCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_key" ON "public"."Branch"("name" ASC);

-- CreateIndex
CREATE INDEX "ClassbookNote_branchId_idx" ON "public"."ClassbookNote"("branchId" ASC);

-- CreateIndex
CREATE INDEX "CurriculumProgress_branchId_idx" ON "public"."CurriculumProgress"("branchId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumProgress_branchId_subtopicId_key" ON "public"."CurriculumProgress"("branchId" ASC, "subtopicId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExamNetResult_examId_studentId_subject_key" ON "public"."ExamNetResult"("examId" ASC, "studentId" ASC, "subject" ASC);

-- CreateIndex
CREATE INDEX "ExamNetResult_studentId_idx" ON "public"."ExamNetResult"("studentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExamSeatAssignment_examId_studentId_key" ON "public"."ExamSeatAssignment"("examId" ASC, "studentId" ASC);

-- CreateIndex
CREATE INDEX "ExamSeatAssignment_studentId_idx" ON "public"."ExamSeatAssignment"("studentId" ASC);

-- CreateIndex
CREATE INDEX "GuidanceNote_studentId_idx" ON "public"."GuidanceNote"("studentId" ASC);

-- CreateIndex
CREATE INDEX "GuidanceProgram_studentId_idx" ON "public"."GuidanceProgram"("studentId" ASC);

-- CreateIndex
CREATE INDEX "Homework_teacherId_idx" ON "public"."Homework"("teacherId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkSubmission_homeworkId_studentId_key" ON "public"."HomeworkSubmission"("homeworkId" ASC, "studentId" ASC);

-- CreateIndex
CREATE INDEX "HomeworkSubmission_studentId_idx" ON "public"."HomeworkSubmission"("studentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "LessonSlot_branchId_day_slot_key" ON "public"."LessonSlot"("branchId" ASC, "day" ASC, "slot" ASC);

-- CreateIndex
CREATE INDEX "LessonSlot_teacherId_idx" ON "public"."LessonSlot"("teacherId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "LoginAttempt_phone_key" ON "public"."LoginAttempt"("phone" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_batchId_idx" ON "public"."NotificationLog"("batchId" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_status_idx" ON "public"."NotificationLog"("status" ASC);

-- CreateIndex
CREATE INDEX "OtpCode_phone_purpose_idx" ON "public"."OtpCode"("phone" ASC, "purpose" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ParentStudent_parentId_studentId_key" ON "public"."ParentStudent"("parentId" ASC, "studentId" ASC);

-- CreateIndex
CREATE INDEX "Question_status_idx" ON "public"."Question"("status" ASC);

-- CreateIndex
CREATE INDEX "Question_studentId_idx" ON "public"."Question"("studentId" ASC);

-- CreateIndex
CREATE INDEX "Question_teacherId_idx" ON "public"."Question"("teacherId" ASC);

-- CreateIndex
CREATE INDEX "Quiz_stage_idx" ON "public"."Quiz"("stage" ASC);

-- CreateIndex
CREATE INDEX "Quiz_teacherId_idx" ON "public"."Quiz"("teacherId" ASC);

-- CreateIndex
CREATE INDEX "QuizBankQuestion_teacherId_idx" ON "public"."QuizBankQuestion"("teacherId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "QuizSubmission_quizId_studentId_key" ON "public"."QuizSubmission"("quizId" ASC, "studentId" ASC);

-- CreateIndex
CREATE INDEX "RemediationTask_studentId_idx" ON "public"."RemediationTask"("studentId" ASC);

-- CreateIndex
CREATE INDEX "ReportCard_studentId_idx" ON "public"."ReportCard"("studentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SeatingArrangement_branchId_key" ON "public"."SeatingArrangement"("branchId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SmsTemplate_key_key" ON "public"."SmsTemplate"("key" ASC);

-- CreateIndex
CREATE INDEX "Student_branchId_idx" ON "public"."Student"("branchId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Student_nationalId_key" ON "public"."Student"("nationalId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentNumber_key" ON "public"."Student"("studentNumber" ASC);

-- CreateIndex
CREATE INDEX "StudentPreference_studentId_idx" ON "public"."StudentPreference"("studentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StudentPreference_studentId_programId_key" ON "public"."StudentPreference"("studentId" ASC, "programId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_institutionalCode_key" ON "public"."Teacher"("institutionalCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_nationalId_key" ON "public"."Teacher"("nationalId" ASC);

-- CreateIndex
CREATE INDEX "TeacherDutySlot_teacherId_idx" ON "public"."TeacherDutySlot"("teacherId" ASC);

-- CreateIndex
CREATE INDEX "TeacherMaterial_branchId_idx" ON "public"."TeacherMaterial"("branchId" ASC);

-- CreateIndex
CREATE INDEX "TeacherMaterial_teacherId_idx" ON "public"."TeacherMaterial"("teacherId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherUnavailability_teacherId_day_slot_key" ON "public"."TeacherUnavailability"("teacherId" ASC, "day" ASC, "slot" ASC);

-- CreateIndex
CREATE INDEX "YearlyPlanRow_teacherId_idx" ON "public"."YearlyPlanRow"("teacherId" ASC);

-- CreateIndex
CREATE INDEX "_BranchTeaching_B_index" ON "public"."_BranchTeaching"("B" ASC);

-- AddForeignKey
ALTER TABLE "public"."AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "public"."Announcement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendanceSubmission" ADD CONSTRAINT "AttendanceSubmission_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendanceSubmission" ADD CONSTRAINT "AttendanceSubmission_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Branch" ADD CONSTRAINT "Branch_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "public"."Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassbookNote" ADD CONSTRAINT "ClassbookNote_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassbookNote" ADD CONSTRAINT "ClassbookNote_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CurriculumProgress" ADD CONSTRAINT "CurriculumProgress_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamNetResult" ADD CONSTRAINT "ExamNetResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "public"."Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamNetResult" ADD CONSTRAINT "ExamNetResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamSeatAssignment" ADD CONSTRAINT "ExamSeatAssignment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "public"."Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamSeatAssignment" ADD CONSTRAINT "ExamSeatAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuidanceNote" ADD CONSTRAINT "GuidanceNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuidanceProgram" ADD CONSTRAINT "GuidanceProgram_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GuidanceProgramEntry" ADD CONSTRAINT "GuidanceProgramEntry_programId_fkey" FOREIGN KEY ("programId") REFERENCES "public"."GuidanceProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Homework" ADD CONSTRAINT "Homework_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "public"."Homework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LessonSlot" ADD CONSTRAINT "LessonSlot_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LessonSlot" ADD CONSTRAINT "LessonSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationBatch" ADD CONSTRAINT "NotificationBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."SmsTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationLog" ADD CONSTRAINT "NotificationLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."NotificationBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParentStudent" ADD CONSTRAINT "ParentStudent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParentStudent" ADD CONSTRAINT "ParentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Question" ADD CONSTRAINT "Question_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Question" ADD CONSTRAINT "Question_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Quiz" ADD CONSTRAINT "Quiz_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Quiz" ADD CONSTRAINT "Quiz_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuizBankQuestion" ADD CONSTRAINT "QuizBankQuestion_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "public"."Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuizSubmission" ADD CONSTRAINT "QuizSubmission_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "public"."Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuizSubmission" ADD CONSTRAINT "QuizSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RemediationTask" ADD CONSTRAINT "RemediationTask_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportCard" ADD CONSTRAINT "ReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeatingArrangement" ADD CONSTRAINT "SeatingArrangement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Student" ADD CONSTRAINT "Student_advisorTeacherId_fkey" FOREIGN KEY ("advisorTeacherId") REFERENCES "public"."Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Student" ADD CONSTRAINT "Student_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudentPreference" ADD CONSTRAINT "StudentPreference_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherDutySlot" ADD CONSTRAINT "TeacherDutySlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherMaterial" ADD CONSTRAINT "TeacherMaterial_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherMaterial" ADD CONSTRAINT "TeacherMaterial_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherUnavailability" ADD CONSTRAINT "TeacherUnavailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."YearlyPlanRow" ADD CONSTRAINT "YearlyPlanRow_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_BranchTeaching" ADD CONSTRAINT "_BranchTeaching_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_BranchTeaching" ADD CONSTRAINT "_BranchTeaching_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

