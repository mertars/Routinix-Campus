import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Trend/analiz için kaç deneme geriye bakılacağı. Sınır BİLEREK var:
// analiz sayfası tüm geçmişi tek sorguda çekseydi (öğrenci × deneme ×
// ders satırları) kurum büyüdükçe doğrusal şişerdi. Son N deneme zaten
// "şu an nerede duruyoruz" sorusunun cevabı.
const DEFAULT_EXAM_WINDOW = 10;
// Kazanım kırılımı ek olarak yanlış/boş soru NUMARALARINI da çekmeyi
// gerektirir (dizi alanlar) — o yüzden daha dar bir pencere.
const SUBTOPIC_EXAM_WINDOW = 3;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function mean(values: number[]): number {
  return values.length > 0 ? round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
}

// GET /api/olcme/analytics?category=TYT — Ölçme Değerlendirme analiz
// panelinin TEK veri kaynağı. Röntgen'in kurum panelinin deneme
// karşılığı: kurum geneli net trendi, ders bazlı ortalamalar, şube
// karşılaştırması, öğrenci bazlı gelişim ve (kazanım eşlemesi yapılmışsa)
// en zayıf kazanımlar.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const categoryParam = request.nextUrl.searchParams.get("category");
    // "__none__" = kategorisiz denemeler; boş/eksik = tüm kategoriler.
    const categoryFilter =
      categoryParam === null || categoryParam === "" ? undefined : categoryParam === "__none__" ? { category: null } : { category: categoryParam };

    // Filtre çubuğunun seçenekleri — HER ZAMAN tüm kategoriler döner
    // (seçili filtreye bakmadan), yoksa bir kategoriye girince diğerlerine
    // geçilemezdi.
    const allCategoryRows = await prisma.exam.findMany({
      where: { institutionId: session.institutionId },
      select: { category: true },
      distinct: ["category"],
    });
    const categories = allCategoryRows.map((r) => r.category).filter((c): c is string => !!c).sort((a, b) => a.localeCompare(b, "tr"));
    const hasUncategorized = allCategoryRows.some((r) => r.category === null);

    const exams = await prisma.exam.findMany({
      where: { institutionId: session.institutionId, ...categoryFilter },
      orderBy: { examDate: "desc" },
      take: DEFAULT_EXAM_WINDOW,
      select: { id: true, name: true, examDate: true, category: true },
    });

    const empty = {
      categories,
      hasUncategorized,
      summary: { examCount: 0, studentCount: 0, averageNet: 0, latestExamName: null as string | null, netChange: null as number | null },
      trend: [],
      subjectAverages: [],
      branches: [],
      students: [],
      weakSubtopics: [],
    };
    if (exams.length === 0) return NextResponse.json(empty);

    const examIds = exams.map((e) => e.id);
    const rows = await prisma.examNetResult.findMany({
      where: { examId: { in: examIds } },
      select: {
        examId: true,
        subject: true,
        net: true,
        student: { select: { id: true, firstName: true, lastName: true, branch: { select: { name: true } } } },
      },
    });
    if (rows.length === 0) return NextResponse.json(empty);

    // --- Öğrenci × deneme toplam netleri ---
    const totalsByExamStudent = new Map<string, number>(); // `${examId}|${studentId}` -> toplam net
    const studentMeta = new Map<string, { firstName: string; lastName: string; branchName: string }>();
    const netsBySubject = new Map<string, number[]>();

    for (const r of rows) {
      const key = `${r.examId}|${r.student.id}`;
      totalsByExamStudent.set(key, (totalsByExamStudent.get(key) ?? 0) + r.net);
      if (!studentMeta.has(r.student.id)) {
        studentMeta.set(r.student.id, { firstName: r.student.firstName, lastName: r.student.lastName, branchName: r.student.branch.name });
      }
      const list = netsBySubject.get(r.subject) ?? [];
      list.push(r.net);
      netsBySubject.set(r.subject, list);
    }

    // --- Deneme bazlı trend (kronolojik: eskiden yeniye) ---
    const chronological = [...exams].reverse();
    const trend = chronological.map((exam) => {
      const totals = [...totalsByExamStudent.entries()].filter(([k]) => k.startsWith(`${exam.id}|`)).map(([, v]) => v);
      return {
        examId: exam.id,
        examName: exam.name,
        examDate: exam.examDate,
        averageNet: mean(totals),
        studentCount: totals.length,
      };
    });
    const trendWithData = trend.filter((t) => t.studentCount > 0);

    // --- Ders ortalamaları ---
    const subjectAverages = [...netsBySubject.entries()]
      .map(([subject, nets]) => ({ subject, averageNet: mean(nets), resultCount: nets.length }))
      .sort((a, b) => a.averageNet - b.averageNet); // zayıf ders önce

    // --- Öğrenci bazlı ---
    const perStudent = new Map<string, { examId: string; examDate: Date; total: number }[]>();
    for (const [key, total] of totalsByExamStudent) {
      const [examId, studentId] = key.split("|");
      const exam = exams.find((e) => e.id === examId);
      if (!exam) continue;
      const list = perStudent.get(studentId) ?? [];
      list.push({ examId, examDate: exam.examDate, total: round(total) });
      perStudent.set(studentId, list);
    }

    const students = [...perStudent.entries()]
      .map(([studentId, entries]) => {
        const sorted = [...entries].sort((a, b) => a.examDate.getTime() - b.examDate.getTime());
        const totals = sorted.map((e) => e.total);
        const latestNet = totals[totals.length - 1];
        const previousNet = totals.length > 1 ? totals[totals.length - 2] : null;
        const meta = studentMeta.get(studentId)!;
        return {
          studentId,
          firstName: meta.firstName,
          lastName: meta.lastName,
          branchName: meta.branchName,
          examCount: totals.length,
          latestNet,
          averageNet: mean(totals),
          bestNet: Math.max(...totals),
          // Son iki denemenin farkı — "yükseliyor mu düşüyor mu" sorusunun
          // en doğrudan cevabı. Tek denemesi olanda null (trend yok).
          delta: previousNet === null ? null : round(latestNet - previousNet),
          history: sorted.map((e) => e.total),
        };
      })
      .sort((a, b) => b.averageNet - a.averageNet);

    // --- Şube karşılaştırması (öğrencinin ORTALAMA netine göre) ---
    const branchMap = new Map<string, number[]>();
    for (const s of students) {
      const list = branchMap.get(s.branchName) ?? [];
      list.push(s.averageNet);
      branchMap.set(s.branchName, list);
    }
    const branches = [...branchMap.entries()]
      .map(([branchName, avgs]) => ({ branchName, studentCount: avgs.length, averageNet: mean(avgs) }))
      .sort((a, b) => b.averageNet - a.averageNet);

    // --- En zayıf kazanımlar (sadece son birkaç deneme) ---
    const subtopicExamIds = chronological.slice(-SUBTOPIC_EXAM_WINDOW).map((e) => e.id);
    const [questions, detailRows] = await Promise.all([
      prisma.examQuestion.findMany({
        where: { examId: { in: subtopicExamIds } },
        select: { examId: true, subject: true, questionNumber: true, subtopicId: true, subtopicLabel: true },
      }),
      prisma.examNetResult.findMany({
        where: { examId: { in: subtopicExamIds } },
        select: { examId: true, studentId: true, subject: true, wrongQuestionNumbers: true, blankQuestionNumbers: true },
      }),
    ]);

    // soru → kazanım haritası, deneme+ders bazında
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
        // "Kazanım atanmadı" varsayılan etiketi analizde gürültü yaratır —
        // gerçek bir kazanım eşlemesi olmayan sorular sayılmaz.
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

    const latest = trendWithData[trendWithData.length - 1] ?? null;
    const previous = trendWithData.length > 1 ? trendWithData[trendWithData.length - 2] : null;

    return NextResponse.json({
      categories,
      hasUncategorized,
      summary: {
        examCount: trendWithData.length,
        studentCount: students.length,
        averageNet: mean(students.map((s) => s.averageNet)),
        latestExamName: latest?.examName ?? null,
        netChange: latest && previous ? round(latest.averageNet - previous.averageNet) : null,
      },
      trend: trendWithData,
      subjectAverages,
      branches,
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
