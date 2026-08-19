// Segment filtresi: "ALL" | "LGS" | "YKS" | "MEZUN" | "5".."12" (sınıf seviyesi).
// lib/mock-data.ts'teki matchesSegment/staffMatchesSegment'in gerçek DB
// karşılığı — Branch.segment (bkz. prisma/schema.prisma) tek gerçek kaynak.
export function branchMatchesSegment(branch: { segment: string; grade: number }, selected: string): boolean {
  if (selected === "ALL") return true;
  if (selected === "LGS" || selected === "YKS" || selected === "MEZUN") return branch.segment === selected;
  const gradeNum = Number(selected);
  return !Number.isNaN(gradeNum) && branch.grade === gradeNum;
}
