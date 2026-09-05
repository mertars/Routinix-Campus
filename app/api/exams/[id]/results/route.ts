import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type SubjectScore = { subject: string; correct: number; wrong: number; blank: number; net: number } | null;

// GET /api/exams/[id]/results — denemenin TAM sonuç tablosu: her öğrencinin
// ders ders doğru/yanlış/boş/net'i, toplam neti, genel ve şube sıralaması.
// Ölçme Değerlendirme'nin "Rapor" adımı bunun üzerine kurulu.
//
// Doğru sayısı ExamNetResult'ta SAKLANMAZ (bkz. o modelin şeması: sadece
// net + yanlış/boş soru NUMARALARI tutulur) — burada o dersin cevap
// anahtarındaki soru sayısından (ExamQuestion) türetilir:
//   doğru = toplam soru - yanlış - boş
// Cevap anahtarı yoksa soru sayısı bilinemez, o yüzden doğru null yerine
// 0 döner ama net yine de gerçek kayıtlı değerdir.
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({
      where: { id: params.id },
      include: { opticalFormat: { include: { subjectBlocks: { orderBy: { order: "asc" } } } } },
    });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const [rows, questionGroups] = await Promise.all([
      prisma.examNetResult.findMany({
        where: { examId: params.id },
        select: {
          subject: true,
          net: true,
          wrongQuestionNumbers: true,
          blankQuestionNumbers: true,
          student: { select: { id: true, firstName: true, lastName: true, studentNumber: true, branch: { select: { name: true } } } },
        },
      }),
      prisma.examQuestion.groupBy({ by: ["subject"], where: { examId: params.id }, _count: { _all: true } }),
    ]);

    const questionCountBySubject = new Map(questionGroups.map((g) => [g.subject, g._count._all]));

    // Sütun sırası: şablonun fiziksel ders sırası önce, sonra kalanlar.
    const presentSubjects = new Set(rows.map((r) => r.subject));
    const ordered = [
      ...(exam.opticalFormat?.subjectBlocks.map((b) => b.subject).filter((s) => presentSubjects.has(s)) ?? []),
      ...[...presentSubjects].sort(),
    ];
    const seenSubject = new Set<string>();
    const subjects = ordered.filter((s) => (seenSubject.has(s) ? false : (seenSubject.add(s), true)));

    type StudentAcc = {
      studentId: string;
      firstName: string;
      lastName: string;
      studentNumber: string;
      branchName: string;
      scores: Map<string, SubjectScore>;
      totalNet: number;
    };
    const byStudent = new Map<string, StudentAcc>();

    for (const r of rows) {
      const entry =
        byStudent.get(r.student.id) ??
        {
          studentId: r.student.id,
          firstName: r.student.firstName,
          lastName: r.student.lastName,
          studentNumber: r.student.studentNumber,
          branchName: r.student.branch.name,
          scores: new Map<string, SubjectScore>(),
          totalNet: 0,
        };
      const total = questionCountBySubject.get(r.subject) ?? 0;
      const wrong = r.wrongQuestionNumbers.length;
      const blank = r.blankQuestionNumbers.length;
      entry.scores.set(r.subject, { subject: r.subject, correct: Math.max(0, total - wrong - blank), wrong, blank, net: r.net });
      entry.totalNet += r.net;
      byStudent.set(r.student.id, entry);
    }

    const students = [...byStudent.values()]
      .map((s) => ({
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        studentNumber: s.studentNumber,
        branchName: s.branchName,
        totalNet: Math.round(s.totalNet * 100) / 100,
        subjects: subjects.map((subject) => s.scores.get(subject) ?? null),
      }))
      .sort((a, b) => b.totalNet - a.totalNet);

    // Genel sıralama — eşit netler AYNI sırayı alır (standart rekabet
    // sıralaması: 1,2,2,4), yoksa aynı neti alan iki öğrenciden birinin
    // "daha iyi" görünmesi gibi yanlış bir izlenim doğar.
    const withRank = students.map((s, i, arr) => {
      const tiedIndex = arr.findIndex((o) => o.totalNet === s.totalNet);
      return { ...s, rank: tiedIndex + 1 };
    });

    const withBranchRank = withRank.map((s) => {
      const peers = withRank.filter((o) => o.branchName === s.branchName);
      const branchRank = peers.findIndex((o) => o.totalNet === s.totalNet) + 1;
      return { ...s, branchRank };
    });

    const totalNets = withBranchRank.map((s) => s.totalNet);
    const stats = {
      studentCount: withBranchRank.length,
      subjectCount: subjects.length,
      averageNet: totalNets.length > 0 ? Math.round((totalNets.reduce((a, b) => a + b, 0) / totalNets.length) * 100) / 100 : 0,
      highestNet: totalNets.length > 0 ? Math.max(...totalNets) : 0,
      lowestNet: totalNets.length > 0 ? Math.min(...totalNets) : 0,
    };

    const subjectStats = subjects.map((subject) => {
      const nets = withBranchRank.map((s) => s.subjects.find((x) => x?.subject === subject)?.net).filter((n): n is number => typeof n === "number");
      return {
        subject,
        questionCount: questionCountBySubject.get(subject) ?? 0,
        averageNet: nets.length > 0 ? Math.round((nets.reduce((a, b) => a + b, 0) / nets.length) * 100) / 100 : 0,
      };
    });

    return NextResponse.json({
      exam: { id: exam.id, name: exam.name, examDate: exam.examDate },
      subjects,
      subjectStats,
      stats,
      students: withBranchRank,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_results_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams/[id]/results", handleGet);
