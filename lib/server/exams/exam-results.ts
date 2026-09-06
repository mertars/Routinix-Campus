import { prisma } from "@/lib/server/prisma";
import { TRACK_SUBJECTS, effectiveTrack, tracksPresentIn } from "./track-mapping";

export type SubjectScore = { subject: string; correct: number; wrong: number; blank: number; net: number } | null;

export type ExamResultStudent = {
  studentId: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
  branchName: string;
  track: string | null;
  totalNet: number;
  subjects: SubjectScore[];
  rank: number;
  branchRank: number;
  trackResult: { track: string; net: number; rank: number | null } | null;
};

export type ExamResultsData = {
  exam: { id: string; name: string; examDate: Date; categoryId: string | null };
  subjects: string[];
  subjectStats: { subject: string; questionCount: number; averageNet: number }[];
  stats: { studentCount: number; subjectCount: number; averageNet: number; highestNet: number; lowestNet: number };
  students: ExamResultStudent[];
  trackRankings: { track: string; subjects: string[]; students: { studentId: string; firstName: string; lastName: string; branchName: string; trackNet: number; rank: number }[] }[];
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function competitionRank(values: number[], value: number): number {
  return values.findIndex((v) => v === value) + 1;
}

// Bir denemenin TAM sonuç hesaplaması — /api/exams/[id]/results (ekran)
// VE karne/sıralama PDF'leri (bkz. exam-karne route) AYNI bu fonksiyonu
// çağırır. Tek yerde tutulmasının nedeni: ekranla PDF'in aynı sayıyı
// göstereceğinden EMİN olmak (ikisi ayrı ayrı hesaplasaydı bir gün
// sessizce birbirinden sapabilirlerdi).
export async function computeExamResults(examId: string): Promise<ExamResultsData | null> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { opticalFormat: { include: { subjectBlocks: { orderBy: { order: "asc" } } } } },
  });
  if (!exam) return null;

  const [rows, questionGroups] = await Promise.all([
    prisma.examNetResult.findMany({
      where: { examId },
      select: {
        subject: true,
        net: true,
        wrongQuestionNumbers: true,
        blankQuestionNumbers: true,
        student: {
          select: { id: true, firstName: true, lastName: true, studentNumber: true, track: true, branch: { select: { name: true, track: true } } },
        },
      },
    }),
    prisma.examQuestion.groupBy({ by: ["subject"], where: { examId }, _count: { _all: true } }),
  ]);

  const questionCountBySubject = new Map(questionGroups.map((g) => [g.subject, g._count._all]));

  const presentSubjects = new Set(rows.map((r) => r.subject));
  const ordered = [
    ...(exam.opticalFormat?.subjectBlocks.map((b) => b.subject).filter((s) => presentSubjects.has(s)) ?? []),
    ...[...presentSubjects].sort(),
  ];
  const seenSubject = new Set<string>();
  const subjects = ordered.filter((s) => (seenSubject.has(s) ? false : (seenSubject.add(s), true)));
  const tracksPresent = tracksPresentIn(subjects);

  type StudentAcc = {
    studentId: string;
    firstName: string;
    lastName: string;
    studentNumber: string;
    branchName: string;
    track: string | null;
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
        track: effectiveTrack(r.student.track, r.student.branch.track),
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
      track: s.track,
      totalNet: round(s.totalNet),
      subjects: subjects.map((subject) => s.scores.get(subject) ?? null),
    }))
    .sort((a, b) => b.totalNet - a.totalNet);

  const genelTotals = students.map((s) => s.totalNet);
  const withRank = students.map((s) => ({ ...s, rank: competitionRank(genelTotals, s.totalNet) }));
  const withBranchRank = withRank.map((s) => {
    const peerTotals = withRank.filter((o) => o.branchName === s.branchName).map((o) => o.totalNet);
    return { ...s, branchRank: competitionRank(peerTotals, s.totalNet) };
  });

  const totalNets = withBranchRank.map((s) => s.totalNet);
  const stats = {
    studentCount: withBranchRank.length,
    subjectCount: subjects.length,
    averageNet: totalNets.length > 0 ? round(totalNets.reduce((a, b) => a + b, 0) / totalNets.length) : 0,
    highestNet: totalNets.length > 0 ? Math.max(...totalNets) : 0,
    lowestNet: totalNets.length > 0 ? Math.min(...totalNets) : 0,
  };

  const subjectStats = subjects.map((subject) => {
    const nets = withBranchRank.map((s) => s.subjects.find((x) => x?.subject === subject)?.net).filter((n): n is number => typeof n === "number");
    return { subject, questionCount: questionCountBySubject.get(subject) ?? 0, averageNet: nets.length > 0 ? round(nets.reduce((a, b) => a + b, 0) / nets.length) : 0 };
  });

  const trackRankings = tracksPresent.map((track) => {
    const trackSubjects = new Set(TRACK_SUBJECTS[track]);
    const peers = withBranchRank
      .filter((s) => s.track === track)
      .map((s) => {
        const trackNet = round(s.subjects.reduce((sum, x) => (x && trackSubjects.has(x.subject) ? sum + x.net : sum), 0));
        return { studentId: s.studentId, firstName: s.firstName, lastName: s.lastName, branchName: s.branchName, trackNet };
      })
      .sort((a, b) => b.trackNet - a.trackNet);
    const totals = peers.map((p) => p.trackNet);
    return { track, subjects: TRACK_SUBJECTS[track].filter((s) => subjects.includes(s)), students: peers.map((p) => ({ ...p, rank: competitionRank(totals, p.trackNet) })) };
  });

  const trackNetByStudent = new Map<string, { track: string; net: number; rank: number | null }>();
  for (const tr of trackRankings) for (const p of tr.students) trackNetByStudent.set(p.studentId, { track: tr.track, net: p.trackNet, rank: p.rank });

  return {
    exam: { id: exam.id, name: exam.name, examDate: exam.examDate, categoryId: exam.categoryId },
    subjects,
    subjectStats,
    stats,
    students: withBranchRank.map((s) => ({ ...s, trackResult: trackNetByStudent.get(s.studentId) ?? null })),
    trackRankings,
  };
}
