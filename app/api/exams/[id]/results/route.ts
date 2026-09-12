import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { computeExamResults } from "@/lib/server/exams/exam-results";
import { computeExamSubtopicBreakdown, computeSubjectColumnGroups, type SubjectColumnCell } from "@/lib/server/exams/subtopic-breakdown";

export const dynamic = "force-dynamic";

// GET /api/exams/[id]/results — denemenin TAM sonuç tablosu (Rapor adımı)
// + alan (track) bazlı sıralamalar. Hesaplama lib/server/exams/
// exam-results.ts > computeExamResults'ta — karne/sıralama PDF'leri de
// AYNI fonksiyonu çağırır, ekranla PDF hiç sapmasın diye.
//
// Kullanıcı talebi: "deneme sonuçlarında fen sosyal değil bu alt dersler
// ve sonuçları yazmalı" — ekran, PDF'lerin (ranking-pdf, karne) ZATEN
// yaptığı alt-ders kırılımını göstermiyordu. `groups`/`columnKeys`
// (computeSubjectColumnGroups, PDF'lerle AYNI fonksiyon) + öğrenci başına
// düzleştirilmiş `subColumnCells` burada eklenir; `subjects`/`students[].
// subjects` alanları GERİYE DÖNÜK aynen korunur (sıralama/CSV dışa aktarım
// hâlâ bunları kullanıyor).
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const data = await computeExamResults(params.id);
    if (!data) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const { groups, columnKeys } = await computeSubjectColumnGroups(params.id, data.subjects);
    const subDersSubjects = groups.filter((g) => g.subColumns.length > 1).map((g) => g.subject);

    const breakdownByStudentSubject = new Map<string, Awaited<ReturnType<typeof computeExamSubtopicBreakdown>>>();
    for (const student of data.students) {
      for (const subject of subDersSubjects) {
        const breakdown = await computeExamSubtopicBreakdown(params.id, student.studentId, subject);
        breakdownByStudentSubject.set(`${student.studentId}|${subject}`, breakdown);
      }
    }

    const studentsWithBreakdown = data.students.map((student) => {
      const subColumnCells: SubjectColumnCell[] = columnKeys.map(({ subject, label }) => {
        if (label) {
          const breakdown = breakdownByStudentSubject.get(`${student.studentId}|${subject}`) ?? [];
          const row = breakdown.find((b) => b.subtopicLabel === label);
          if (!row) return null;
          return { correct: row.correct, wrong: row.wrong, blank: row.blank, net: Math.round((row.correct - row.wrong / 4) * 100) / 100 };
        }
        const cell = student.subjects.find((x) => x?.subject === subject);
        return cell ? { correct: cell.correct, wrong: cell.wrong, blank: cell.blank, net: cell.net } : null;
      });
      return { ...student, subColumnCells };
    });

    return NextResponse.json({ ...data, groups, students: studentsWithBreakdown });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_results_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams/[id]/results", handleGet);
