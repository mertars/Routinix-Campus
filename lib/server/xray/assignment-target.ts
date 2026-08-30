import { prisma } from "@/lib/server/prisma";
import { XRAY_MIN_GRADE } from "@/lib/mock-data";

// Faz L — Toplu atama: yönetici Test 1/Test 2'yi TEK öğrenciye değil, bir
// şubenin TAMAMINA ya da bir sınıf seviyesinin TAMAMINA da atayabilir (bkz.
// xray-assignment-section.tsx/xray-practice-assignment-section.tsx'teki
// hedef seçici). Bu SAF olmayan (DB'ye bağımlı) ama HER İKİ atama
// endpoint'inin (practice-assignments, comprehension-assignments) paylaştığı
// TEK doğrulama/çözümleme noktası — istemciden gelen "bu şubede şu
// öğrenciler var" varsayımına ASLA güvenilmez, institutionId + XRAY_MIN_GRADE
// her yolda SUNUCU TARAFINDA yeniden doğrulanır.
export type AssignmentTarget = { type: "student"; studentId: string } | { type: "branch"; branchId: string } | { type: "grade"; grade: number };

export async function resolveTargetStudentIds(institutionId: string, target: AssignmentTarget): Promise<string[]> {
  if (target.type === "student") {
    const student = await prisma.student.findFirst({ where: { id: target.studentId, institutionId, isActive: true }, select: { id: true } });
    return student ? [student.id] : [];
  }

  if (target.type === "branch") {
    const students = await prisma.student.findMany({
      where: { institutionId, isActive: true, branchId: target.branchId, branch: { grade: { gte: XRAY_MIN_GRADE } } },
      select: { id: true },
    });
    return students.map((s) => s.id);
  }

  if (target.grade < XRAY_MIN_GRADE) return [];
  const students = await prisma.student.findMany({
    where: { institutionId, isActive: true, branch: { grade: target.grade } },
    select: { id: true },
  });
  return students.map((s) => s.id);
}
