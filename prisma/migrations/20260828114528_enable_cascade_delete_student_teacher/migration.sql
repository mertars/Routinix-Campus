-- DropForeignKey
-- ⚠️ Bu iki DEĞİŞİKLİK (Branch.advisorId, Student.advisorTeacherId) `prisma
-- migrate dev --create-only` interaktif bir soruda takılıp kaldığı için
-- diff'e hiç girmedi — elle eklendi. AŞAĞIDAKİLERİ Cascade DEĞİL SetNull
-- yapıyoruz: bir öğretmen tamamen silindiğinde danışmanı olduğu şube/
-- öğrenci SİLİNMEMELİ, sadece danışmansız kalmalı (bkz. schema.prisma'daki
-- aynı gerekçe notları).
ALTER TABLE "Branch" DROP CONSTRAINT "Branch_advisorId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_advisorTeacherId_fkey";

-- DropForeignKey
ALTER TABLE "AnnouncementRead" DROP CONSTRAINT "AnnouncementRead_studentId_fkey";

-- DropForeignKey
ALTER TABLE "AppointmentRequest" DROP CONSTRAINT "AppointmentRequest_studentId_fkey";

-- DropForeignKey
ALTER TABLE "AppointmentRequest" DROP CONSTRAINT "AppointmentRequest_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT "AttendanceRecord_studentId_fkey";

-- DropForeignKey
ALTER TABLE "AttendanceSubmission" DROP CONSTRAINT "AttendanceSubmission_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "ClassbookNote" DROP CONSTRAINT "ClassbookNote_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "ExamNetResult" DROP CONSTRAINT "ExamNetResult_studentId_fkey";

-- DropForeignKey
ALTER TABLE "ExamSeatAssignment" DROP CONSTRAINT "ExamSeatAssignment_studentId_fkey";

-- DropForeignKey
ALTER TABLE "GuidanceNote" DROP CONSTRAINT "GuidanceNote_studentId_fkey";

-- DropForeignKey
ALTER TABLE "GuidanceProgram" DROP CONSTRAINT "GuidanceProgram_studentId_fkey";

-- DropForeignKey
ALTER TABLE "GuidanceProgramEntry" DROP CONSTRAINT "GuidanceProgramEntry_programId_fkey";

-- DropForeignKey
ALTER TABLE "Homework" DROP CONSTRAINT "Homework_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "HomeworkSubmission" DROP CONSTRAINT "HomeworkSubmission_homeworkId_fkey";

-- DropForeignKey
ALTER TABLE "HomeworkSubmission" DROP CONSTRAINT "HomeworkSubmission_studentId_fkey";

-- DropForeignKey
ALTER TABLE "LessonSlot" DROP CONSTRAINT "LessonSlot_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "ParentStudent" DROP CONSTRAINT "ParentStudent_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "Quiz" DROP CONSTRAINT "Quiz_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "QuizBankQuestion" DROP CONSTRAINT "QuizBankQuestion_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "QuizQuestion" DROP CONSTRAINT "QuizQuestion_quizId_fkey";

-- DropForeignKey
ALTER TABLE "QuizSubmission" DROP CONSTRAINT "QuizSubmission_quizId_fkey";

-- DropForeignKey
ALTER TABLE "QuizSubmission" DROP CONSTRAINT "QuizSubmission_studentId_fkey";

-- DropForeignKey
ALTER TABLE "RemediationTask" DROP CONSTRAINT "RemediationTask_studentId_fkey";

-- DropForeignKey
ALTER TABLE "ReportCard" DROP CONSTRAINT "ReportCard_studentId_fkey";

-- DropForeignKey
ALTER TABLE "StudentPreference" DROP CONSTRAINT "StudentPreference_studentId_fkey";

-- DropForeignKey
ALTER TABLE "TeacherDutySlot" DROP CONSTRAINT "TeacherDutySlot_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "TeacherMaterial" DROP CONSTRAINT "TeacherMaterial_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "TeacherUnavailability" DROP CONSTRAINT "TeacherUnavailability_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "YearlyPlanRow" DROP CONSTRAINT "YearlyPlanRow_teacherId_fkey";

-- AddForeignKey
ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamNetResult" ADD CONSTRAINT "ExamNetResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSubmission" ADD CONSTRAINT "AttendanceSubmission_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSubmission" ADD CONSTRAINT "QuizSubmission_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSubmission" ADD CONSTRAINT "QuizSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizBankQuestion" ADD CONSTRAINT "QuizBankQuestion_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherUnavailability" ADD CONSTRAINT "TeacherUnavailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidanceNote" ADD CONSTRAINT "GuidanceNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassbookNote" ADD CONSTRAINT "ClassbookNote_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YearlyPlanRow" ADD CONSTRAINT "YearlyPlanRow_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherMaterial" ADD CONSTRAINT "TeacherMaterial_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSeatAssignment" ADD CONSTRAINT "ExamSeatAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPreference" ADD CONSTRAINT "StudentPreference_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSlot" ADD CONSTRAINT "LessonSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDutySlot" ADD CONSTRAINT "TeacherDutySlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidanceProgram" ADD CONSTRAINT "GuidanceProgram_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidanceProgramEntry" ADD CONSTRAINT "GuidanceProgramEntry_programId_fkey" FOREIGN KEY ("programId") REFERENCES "GuidanceProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemediationTask" ADD CONSTRAINT "RemediationTask_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_advisorTeacherId_fkey" FOREIGN KEY ("advisorTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
