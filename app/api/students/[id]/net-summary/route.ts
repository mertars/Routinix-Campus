import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/students/[id]/net-summary — Net & Derece Takipçisi'nin gerçek
// veri kaynağı: hedef/gerçekleşen net, branş bazlı ders trendi, şube ve
// kurum sıralaması. Tüm sıralama gerçek Student+ExamNetResult verisinden
// hesaplanır (INITIAL_STUDENT_REPORTS mock'u artık kullanılmıyor).
async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const student = await prisma.student.findUnique({ where: { id: params.id }, include: { branch: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const netResults = await prisma.examNetResult.findMany({
      where: { studentId: student.id },
      include: { exam: true },
      orderBy: { exam: { examDate: "asc" } },
    });

    const trendBySubject: Record<string, { examLabel: string; net: number }[]> = {};
    for (const r of netResults) {
      (trendBySubject[r.subject] ??= []).push({ examLabel: r.exam.name, net: r.net });
    }

    const latestExamId = netResults.at(-1)?.examId ?? null;
    const actualNet = latestExamId
      ? Math.round(netResults.filter((r) => r.examId === latestExamId).reduce((sum, r) => sum + r.net, 0) * 100) / 100
      : 0;

    // Şube/kurum sıralaması: her öğrencinin tüm derslerdeki net toplamına göre.
    const allNets = await prisma.examNetResult.findMany({
      select: { studentId: true, net: true, student: { select: { branchId: true } } },
    });
    const totalByStudent = new Map<string, { total: number; branchId: string }>();
    for (const r of allNets) {
      const entry = totalByStudent.get(r.studentId) ?? { total: 0, branchId: r.student.branchId };
      entry.total += r.net;
      totalByStudent.set(r.studentId, entry);
    }
    const branchMates = [...totalByStudent.entries()]
      .filter(([, v]) => v.branchId === student.branchId)
      .sort((a, b) => b[1].total - a[1].total);
    const branchRank = Math.max(1, branchMates.findIndex(([id]) => id === student.id) + 1);

    const institutionRanked = [...totalByStudent.entries()].sort((a, b) => b[1].total - a[1].total);
    const institutionRank = Math.max(1, institutionRanked.findIndex(([id]) => id === student.id) + 1);

    const estimatedNationwidePercentile = Math.min(99, Math.max(1, Math.round(actualNet * 0.7)));

    return NextResponse.json({
      targetNet: student.targetNet,
      actualNet,
      trendBySubject,
      branchRank,
      institutionRank,
      estimatedNationwidePercentile,
    });
  } catch (error) {
    logger.error("net_summary_failed", { studentId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/students/[id]/net-summary", handleGet);
