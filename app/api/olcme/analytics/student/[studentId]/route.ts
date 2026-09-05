import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const SESSION_WINDOW = 12;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
function mean(values: number[]): number {
  return values.length > 0 ? round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
}

// GET /api/olcme/analytics/student/[studentId]?categoryId=
// Öğrenciye özel analiz paneli: deneme deneme toplam net + her dersin
// doğru/yanlış/boş kırılımı + o denemedeki sırası, ders ortalamaları ve
// (kazanım eşlemesi varsa) kişisel zayıf kazanımlar.
async function handleGet(request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const student = await prisma.student.findUnique({
      where: { id: params.studentId },
      select: { id: true, firstName: true, lastName: true, studentNumber: true, institutionId: true, branch: { select: { name: true, grade: true } } },
    });
    if (!student || student.institutionId !== session.institutionId) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const categoryId = request.nextUrl.searchParams.get("categoryId") || null;
    const category = categoryId
      ? await prisma.examCategory.findUnique({ where: { id: categoryId }, select: { kind: true, institutionId: true } })
      : null;
    if (categoryId && (!category || category.institutionId !== session.institutionId)) {
      return NextResponse.json({ error: "Klasör bulunamadı." }, { status: 404 });
    }

    // Oturum kavramı ana analiz ucuyla AYNI (bkz. /api/olcme/analytics):
    // YKS klasöründe bir oturum TYT+AYT eşleşmesidir.
    type Session = { id: string; name: string; date: Date; examIds: string[] };
    let sessions: Session[];
    if (category?.kind === "YKS_PAIR") {
      const groups = await prisma.examGroup.findMany({
        where: { institutionId: session.institutionId },
        orderBy: { examDate: "desc" },
        take: SESSION_WINDOW,
        select: { id: true, name: true, examDate: true, exams: { select: { id: true } } },
      });
      sessions = groups.map((g) => ({ id: g.id, name: g.name, date: g.examDate, examIds: g.exams.map((e) => e.id) }));
    } else {
      const exams = await prisma.exam.findMany({
        where: { institutionId: session.institutionId, ...(categoryId ? { categoryId } : {}) },
        orderBy: { examDate: "desc" },
        take: SESSION_WINDOW,
        select: { id: true, name: true, examDate: true },
      });
      sessions = exams.map((e) => ({ id: e.id, name: e.name, date: e.examDate, examIds: [e.id] }));
    }

    const allExamIds = sessions.flatMap((s) => s.examIds);
    if (allExamIds.length === 0) {
      return NextResponse.json({ student: { ...student, institutionId: undefined }, sessions: [], subjectAverages: [], weakSubtopics: [] });
    }

    const [mine, everyone, questionCounts] = await Promise.all([
      prisma.examNetResult.findMany({
        where: { examId: { in: allExamIds }, studentId: params.studentId },
        select: { examId: true, subject: true, net: true, wrongQuestionNumbers: true, blankQuestionNumbers: true },
      }),
      // Sıralama için herkesin TOPLAM neti gerekiyor — ders kırılımı değil,
      // o yüzden dizi alanları çekilmiyor (yükü gereksiz büyütmemek için).
      prisma.examNetResult.findMany({ where: { examId: { in: allExamIds } }, select: { examId: true, studentId: true, net: true } }),
      prisma.examQuestion.groupBy({ by: ["examId", "subject"], where: { examId: { in: allExamIds } }, _count: { _all: true } }),
    ]);

    const questionCountByExamSubject = new Map(questionCounts.map((q) => [`${q.examId}|${q.subject}`, q._count._all]));
    const examToSession = new Map<string, string>();
    for (const s of sessions) for (const id of s.examIds) examToSession.set(id, s.id);

    // Oturum bazında herkesin toplamı → sıralama
    const totalsBySession = new Map<string, Map<string, number>>();
    for (const r of everyone) {
      const sid = examToSession.get(r.examId);
      if (!sid) continue;
      const inner = totalsBySession.get(sid) ?? new Map<string, number>();
      inner.set(r.studentId, (inner.get(r.studentId) ?? 0) + r.net);
      totalsBySession.set(sid, inner);
    }

    const mineBySession = new Map<string, typeof mine>();
    for (const r of mine) {
      const sid = examToSession.get(r.examId);
      if (!sid) continue;
      mineBySession.set(sid, [...(mineBySession.get(sid) ?? []), r]);
    }

    const chronological = [...sessions].reverse();
    const sessionRows = chronological
      .filter((s) => mineBySession.has(s.id))
      .map((s) => {
        const rows = mineBySession.get(s.id)!;
        const totalNet = round(rows.reduce((sum, r) => sum + r.net, 0));
        const allTotals = [...(totalsBySession.get(s.id)?.values() ?? [])].sort((a, b) => b - a);
        const rank = allTotals.findIndex((t) => Math.abs(t - totalNet) < 0.001) + 1;
        return {
          sessionId: s.id,
          name: s.name,
          date: s.date,
          totalNet,
          rank: rank > 0 ? rank : null,
          participantCount: allTotals.length,
          subjects: rows.map((r) => {
            const total = questionCountByExamSubject.get(`${r.examId}|${r.subject}`) ?? 0;
            return {
              subject: r.subject,
              correct: Math.max(0, total - r.wrongQuestionNumbers.length - r.blankQuestionNumbers.length),
              wrong: r.wrongQuestionNumbers.length,
              blank: r.blankQuestionNumbers.length,
              net: r.net,
            };
          }),
        };
      });

    const netsBySubject = new Map<string, number[]>();
    for (const r of mine) netsBySubject.set(r.subject, [...(netsBySubject.get(r.subject) ?? []), r.net]);
    const subjectAverages = [...netsBySubject.entries()]
      .map(([subject, nets]) => ({ subject, averageNet: mean(nets), examCount: nets.length }))
      .sort((a, b) => a.averageNet - b.averageNet);

    // Kişisel zayıf kazanımlar
    const questions = await prisma.examQuestion.findMany({
      where: { examId: { in: allExamIds } },
      select: { examId: true, subject: true, questionNumber: true, subtopicId: true, subtopicLabel: true },
    });
    const questionMap = new Map<string, Map<number, { subtopicId: string | null; subtopicLabel: string }>>();
    for (const q of questions) {
      const key = `${q.examId}|${q.subject}`;
      const inner = questionMap.get(key) ?? new Map();
      inner.set(q.questionNumber, { subtopicId: q.subtopicId, subtopicLabel: q.subtopicLabel });
      questionMap.set(key, inner);
    }
    const agg = new Map<string, { label: string; correct: number; total: number }>();
    for (const r of mine) {
      if (r.wrongQuestionNumbers.length === 0 && r.blankQuestionNumbers.length === 0) continue;
      const inner = questionMap.get(`${r.examId}|${r.subject}`);
      if (!inner) continue;
      const wrong = new Set(r.wrongQuestionNumbers);
      const blank = new Set(r.blankQuestionNumbers);
      for (const [qn, meta] of inner) {
        if (!meta.subtopicId && meta.subtopicLabel === "Kazanım atanmadı") continue;
        const key = meta.subtopicId ?? `label:${meta.subtopicLabel}`;
        const a = agg.get(key) ?? { label: meta.subtopicLabel, correct: 0, total: 0 };
        a.total++;
        if (!wrong.has(qn) && !blank.has(qn)) a.correct++;
        agg.set(key, a);
      }
    }
    const weakSubtopics = [...agg.values()]
      .map((a) => ({ subtopicLabel: a.label, percent: a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0, questionCount: a.total }))
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 10);

    return NextResponse.json({
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        studentNumber: student.studentNumber,
        branchName: student.branch.name,
        grade: student.branch.grade,
      },
      sessions: sessionRows,
      subjectAverages,
      weakSubtopics,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("olcme_student_analytics_failed", { studentId: params.studentId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/olcme/analytics/student/[studentId]", handleGet);
