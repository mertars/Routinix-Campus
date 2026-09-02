import { prisma } from "@/lib/server/prisma";
import { XRAY_MIN_GRADE } from "@/lib/mock-data";

export type BranchOverview = {
  branchId: string;
  branchName: string;
  grade: number;
  studentCount: number;
  testedCount: number;
  average: number | null;
  redZoneCount: number;
};

export type GradeOverview = {
  grade: number;
  studentCount: number;
  testedCount: number;
  average: number | null;
  redZoneCount: number;
  branches: BranchOverview[];
};

export type InstitutionOverview = {
  subject: string;
  studentCount: number;
  testedCount: number;
  average: number | null;
  redZoneCount: number;
  grades: GradeOverview[];
};

const RED_ZONE_THRESHOLD = 30;

// Kullanıcı talebi — "sistem tamamen öğrenci üstünden çalışıyor, genel
// ekranlar lazım": kurum geneli → sınıf seviyesi → şube şeklinde 3
// katmanlı bir drill-down için TEK bir sorgu turunda tüm ağacı hesaplar
// (bir okulun şube/öğrenci sayısı için client-side'da tek seferde
// tutulabilecek küçüklükte — /api/xray/branch-average'daki "önce
// per-student ortalamayı YUVARLA, sonra yuvarlanmış değerleri ortala"
// deseniyle BİREBİR AYNI matematik, iki ekran arasında sayı tutarsızlığı
// olmasın diye (bir şubenin burada görünen ortalaması, o şube tek başına
// /api/xray/branch-average'dan sorgulandığında da AYNI çıkar).
export async function getInstitutionOverview(institutionId: string, subject: string): Promise<InstitutionOverview> {
  const branches = await prisma.branch.findMany({
    where: { institutionId, grade: { gte: XRAY_MIN_GRADE } },
    select: { id: true, name: true, grade: true },
  });

  const students = await prisma.student.findMany({
    where: { branchId: { in: branches.map((b) => b.id) }, isActive: true },
    select: { id: true, branchId: true },
  });
  const studentIds = students.map((s) => s.id);

  const [byStudentAvg, byStudentRedZone] = await Promise.all([
    prisma.topicMasteryAssessment.groupBy({
      by: ["studentId"],
      where: { subject, studentId: { in: studentIds } },
      _avg: { masteryScore: true },
    }),
    prisma.topicMasteryAssessment.groupBy({
      by: ["studentId"],
      where: { subject, studentId: { in: studentIds }, masteryScore: { lt: RED_ZONE_THRESHOLD } },
      _count: true,
    }),
  ]);

  const avgByStudent = new Map(byStudentAvg.map((r) => [r.studentId, Math.round(r._avg.masteryScore ?? 0)]));
  const redZoneByStudent = new Map(byStudentRedZone.map((r) => [r.studentId, r._count]));

  const studentsByBranch = new Map<string, string[]>();
  for (const s of students) {
    const list = studentsByBranch.get(s.branchId) ?? [];
    list.push(s.id);
    studentsByBranch.set(s.branchId, list);
  }

  function summarize(ids: string[]) {
    const tested = ids.filter((id) => avgByStudent.has(id));
    const average = tested.length === 0 ? null : Math.round(tested.reduce((sum, id) => sum + (avgByStudent.get(id) ?? 0), 0) / tested.length);
    const redZoneCount = ids.reduce((sum, id) => sum + (redZoneByStudent.get(id) ?? 0), 0);
    return { studentCount: ids.length, testedCount: tested.length, average, redZoneCount };
  }

  const branchSummaries: BranchOverview[] = branches
    .map((b) => ({ branchId: b.id, branchName: b.name, grade: b.grade, ...summarize(studentsByBranch.get(b.id) ?? []) }))
    .sort((a, b) => a.branchName.localeCompare(b.branchName, "tr"));

  const gradeNumbers = [...new Set(branches.map((b) => b.grade))].sort((a, b) => a - b);
  const grades: GradeOverview[] = gradeNumbers.map((grade) => {
    const gradeBranches = branchSummaries.filter((b) => b.grade === grade);
    const ids = gradeBranches.flatMap((b) => studentsByBranch.get(b.branchId) ?? []);
    return { grade, branches: gradeBranches, ...summarize(ids) };
  });

  return { subject, grades, ...summarize(studentIds) };
}
