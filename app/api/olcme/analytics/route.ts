import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { ensureDefaultCategories } from "@/lib/server/exams/categories";

export const dynamic = "force-dynamic";

const SESSION_WINDOW = 10;
const SUBTOPIC_SESSION_WINDOW = 3;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
function mean(values: number[]): number {
  return values.length > 0 ? round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
}

// Analizin temel birimi "oturum" (session). Sıradan bir klasörde bir
// oturum = bir deneme. YKS klasöründe ise bir oturum = bir TYT+AYT
// EŞLEŞMESİ (ExamGroup) — kullanıcı kararı: "YKS sekmesinde denemeler
// ikili ele alınacak". Böylece toplam net ikisinin toplamı olur ve trend
// grafiğinde YKS denemesi tek bir nokta olarak görünür.
type Session = { id: string; name: string; date: Date; examIds: string[] };

// GET /api/olcme/analytics?categoryId=&grade=&branchId=
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");
    await ensureDefaultCategories(session.institutionId);

    const sp = request.nextUrl.searchParams;
    const categoryId = sp.get("categoryId") || null;
    const gradeParam = sp.get("grade");
    const grade = gradeParam ? Number(gradeParam) : null;
    const branchId = sp.get("branchId") || null;

    const categories = await prisma.examCategory.findMany({
      where: { institutionId: session.institutionId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true },
    });
    const selectedCategory = categoryId ? categories.find((c) => c.id === categoryId) ?? null : null;

    // --- Oturumları kur ---
    let sessions: Session[] = [];
    if (selectedCategory?.kind === "YKS_PAIR") {
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

    const empty = {
      categories,
      grades: [] as number[],
      branches: [] as { branchId: string; branchName: string; grade: number; studentCount: number; averageNet: number }[],
      summary: { sessionCount: 0, studentCount: 0, averageNet: 0, latestName: null as string | null, netChange: null as number | null },
      trend: [],
      subjectAverages: [],
      gradeBreakdown: [],
      students: [],
      weakSubtopics: [],
    };
    const allExamIds = sessions.flatMap((s) => s.examIds);
    if (allExamIds.length === 0) return NextResponse.json(empty);

    const rows = await prisma.examNetResult.findMany({
      where: { examId: { in: allExamIds } },
      select: {
        examId: true,
        subject: true,
        net: true,
        student: {
          select: { id: true, firstName: true, lastName: true, branch: { select: { id: true, name: true, grade: true } } },
        },
      },
    });
    if (rows.length === 0) return NextResponse.json({ ...empty, categories });

    // Filtre seçenekleri, FİLTRE UYGULANMADAN önce hesaplanır — yoksa bir
    // seviyeye girince diğer seviyelere geçilemezdi.
    const grades = [...new Set(rows.map((r) => r.student.branch.grade))].sort((a, b) => a - b);

    const scoped = rows.filter(
      (r) => (grade === null || r.student.branch.grade === grade) && (branchId === null || r.student.branch.id === branchId)
    );
    if (scoped.length === 0) return NextResponse.json({ ...empty, categories, grades });

    const examToSession = new Map<string, string>();
    for (const s of sessions) for (const id of s.examIds) examToSession.set(id, s.id);

    // --- Öğrenci × oturum toplam netleri ---
    const totals = new Map<string, number>(); // `${sessionId}|${studentId}`
    const studentMeta = new Map<string, { firstName: string; lastName: string; branchId: string; branchName: string; grade: number }>();
    const netsBySubject = new Map<string, number[]>();

    for (const r of scoped) {
      const sessionId = examToSession.get(r.examId);
      if (!sessionId) continue;
      const key = `${sessionId}|${r.student.id}`;
      totals.set(key, (totals.get(key) ?? 0) + r.net);
      if (!studentMeta.has(r.student.id)) {
        studentMeta.set(r.student.id, {
          firstName: r.student.firstName,
          lastName: r.student.lastName,
          branchId: r.student.branch.id,
          branchName: r.student.branch.name,
          grade: r.student.branch.grade,
        });
      }
      netsBySubject.set(r.subject, [...(netsBySubject.get(r.subject) ?? []), r.net]);
    }

    const chronological = [...sessions].reverse();
    const trend = chronological
      .map((s) => {
        const values = [...totals.entries()].filter(([k]) => k.startsWith(`${s.id}|`)).map(([, v]) => v);
        return { sessionId: s.id, name: s.name, date: s.date, averageNet: mean(values), studentCount: values.length };
      })
      .filter((t) => t.studentCount > 0);

    const subjectAverages = [...netsBySubject.entries()]
      .map(([subject, nets]) => ({ subject, averageNet: mean(nets), resultCount: nets.length }))
      .sort((a, b) => a.averageNet - b.averageNet);

    // --- Öğrenci bazlı ---
    const perStudent = new Map<string, { date: Date; total: number }[]>();
    for (const [key, total] of totals) {
      const [sessionId, studentId] = key.split("|");
      const s = sessions.find((x) => x.id === sessionId);
      if (!s) continue;
      perStudent.set(studentId, [...(perStudent.get(studentId) ?? []), { date: s.date, total: round(total) }]);
    }

    const students = [...perStudent.entries()]
      .map(([studentId, entries]) => {
        const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime()).map((e) => e.total);
        const meta = studentMeta.get(studentId)!;
        const latestNet = sorted[sorted.length - 1];
        const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
        return {
          studentId,
          firstName: meta.firstName,
          lastName: meta.lastName,
          branchId: meta.branchId,
          branchName: meta.branchName,
          grade: meta.grade,
          examCount: sorted.length,
          latestNet,
          averageNet: mean(sorted),
          bestNet: Math.max(...sorted),
          delta: prev === null ? null : round(latestNet - prev),
          history: sorted,
        };
      })
      .sort((a, b) => b.averageNet - a.averageNet);

    // --- Şube ve seviye kırılımları ---
    const branchMap = new Map<string, { name: string; grade: number; nets: number[] }>();
    const gradeMap = new Map<number, number[]>();
    for (const s of students) {
      const b = branchMap.get(s.branchId) ?? { name: s.branchName, grade: s.grade, nets: [] };
      b.nets.push(s.averageNet);
      branchMap.set(s.branchId, b);
      gradeMap.set(s.grade, [...(gradeMap.get(s.grade) ?? []), s.averageNet]);
    }
    const branches = [...branchMap.entries()]
      .map(([id, b]) => ({ branchId: id, branchName: b.name, grade: b.grade, studentCount: b.nets.length, averageNet: mean(b.nets) }))
      .sort((a, b) => a.grade - b.grade || b.averageNet - a.averageNet);
    const gradeBreakdown = [...gradeMap.entries()]
      .map(([g, nets]) => ({ grade: g, studentCount: nets.length, averageNet: mean(nets) }))
      .sort((a, b) => a.grade - b.grade);

    // --- En zayıf kazanımlar (son birkaç oturum) ---
    const subtopicExamIds = chronological.slice(-SUBTOPIC_SESSION_WINDOW).flatMap((s) => s.examIds);
    const scopedStudentIds = new Set(students.map((s) => s.studentId));
    const [questions, detailRows] = await Promise.all([
      prisma.examQuestion.findMany({
        where: { examId: { in: subtopicExamIds } },
        select: { examId: true, subject: true, questionNumber: true, subtopicId: true, subtopicLabel: true },
      }),
      prisma.examNetResult.findMany({
        where: { examId: { in: subtopicExamIds }, studentId: { in: [...scopedStudentIds] } },
        select: { examId: true, studentId: true, subject: true, wrongQuestionNumbers: true, blankQuestionNumbers: true },
      }),
    ]);

    const questionMap = new Map<string, Map<number, { subtopicId: string | null; subtopicLabel: string }>>();
    for (const q of questions) {
      const key = `${q.examId}|${q.subject}`;
      const inner = questionMap.get(key) ?? new Map();
      inner.set(q.questionNumber, { subtopicId: q.subtopicId, subtopicLabel: q.subtopicLabel });
      questionMap.set(key, inner);
    }

    const subtopicAgg = new Map<string, { label: string; correct: number; total: number; students: Set<string> }>();
    for (const r of detailRows) {
      if (r.wrongQuestionNumbers.length === 0 && r.blankQuestionNumbers.length === 0) continue;
      const inner = questionMap.get(`${r.examId}|${r.subject}`);
      if (!inner) continue;
      const wrong = new Set(r.wrongQuestionNumbers);
      const blank = new Set(r.blankQuestionNumbers);
      for (const [questionNumber, meta] of inner) {
        if (!meta.subtopicId && meta.subtopicLabel === "Kazanım atanmadı") continue;
        const key = meta.subtopicId ?? `label:${meta.subtopicLabel}`;
        const agg = subtopicAgg.get(key) ?? { label: meta.subtopicLabel, correct: 0, total: 0, students: new Set<string>() };
        agg.total++;
        if (!wrong.has(questionNumber) && !blank.has(questionNumber)) agg.correct++;
        agg.students.add(r.studentId);
        subtopicAgg.set(key, agg);
      }
    }
    const weakSubtopics = [...subtopicAgg.values()]
      .map((a) => ({ subtopicLabel: a.label, averagePercent: a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0, studentCount: a.students.size }))
      .sort((a, b) => a.averagePercent - b.averagePercent)
      .slice(0, 12);

    const latest = trend[trend.length - 1] ?? null;
    const previous = trend.length > 1 ? trend[trend.length - 2] : null;

    return NextResponse.json({
      categories,
      grades,
      branches,
      gradeBreakdown,
      summary: {
        sessionCount: trend.length,
        studentCount: students.length,
        averageNet: mean(students.map((s) => s.averageNet)),
        latestName: latest?.name ?? null,
        netChange: latest && previous ? round(latest.averageNet - previous.averageNet) : null,
      },
      trend,
      subjectAverages,
      students,
      weakSubtopics,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("olcme_analytics_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/olcme/analytics", handleGet);
