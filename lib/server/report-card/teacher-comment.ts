import { prisma } from "@/lib/server/prisma";

// Danışman/branş öğretmeni bu dönem için TEK bir yorumu istediği zaman
// günceller (bkz. şemadaki @@unique([studentId, periodLabel]) notu).
export async function upsertReportCardTeacherComment(input: {
  studentId: string;
  periodLabel: string;
  teacherId: string;
  comment: string;
}) {
  const trimmed = input.comment.trim();
  return prisma.reportCardTeacherComment.upsert({
    where: { studentId_periodLabel: { studentId: input.studentId, periodLabel: input.periodLabel } },
    update: { comment: trimmed, teacherId: input.teacherId },
    create: { studentId: input.studentId, periodLabel: input.periodLabel, teacherId: input.teacherId, comment: trimmed },
  });
}

export async function getReportCardTeacherComment(studentId: string, periodLabel: string) {
  return prisma.reportCardTeacherComment.findUnique({ where: { studentId_periodLabel: { studentId, periodLabel } } });
}
