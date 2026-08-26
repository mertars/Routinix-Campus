import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { computeAttendanceRate } from "@/lib/server/report-card/analyzer";
import { computeRisk } from "@/lib/server/risk/compute-risk";
import { branchMatchesSegment } from "@/lib/server/segment";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withTtlCache } from "@/lib/server/cache/ttl-cache";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Bu uç, öğrenci rosterinin TAMAMINI (net/devam/ödev geçmişiyle) tarayıp
// risk skorunu her istekte yeniden hesaplıyor — kurum büyüdükçe (100'lerce
// öğrenci) pahalılaşan bir agregasyon. Dashboard'un saniye saniye canlı
// olması gerekmediği için (bkz. FAZ 6 planı) kısa bir TTL ile önbelleklenir;
// segment DEĞİŞTİĞİNDE farklı bir anahtara düşer, o yüzden segment
// filtrelemesi asla bayat veri göstermez — sadece AYNI segmentin kendisi
// TTL süresince tazelenmez.
const DASHBOARD_CACHE_TTL_MS = 20_000;

// GET /api/admin/dashboard?segment=ALL|LGS|YKS|MEZUN|5..12 — Yönetici panelinin
// üst istatistik şeridi, "Genel Bakış" sekmesi ve ilgili 5 modal (Şubeler,
// Kadro, Deneme Yükleme, Risk Kutusu, Öğrenci listesi) İÇİN TEK gerçek veri
// kaynağı — hepsi aynı segment-filtrelenmiş gerçek DB sorgusunu paylaşır.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const segment = request.nextUrl.searchParams.get("segment") ?? "ALL";

    const payload = await withTtlCache(
      `admin-dashboard:${session.institutionId}:${segment}`,
      DASHBOARD_CACHE_TTL_MS,
      () => computeDashboard(session.institutionId, segment)
    );

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_dashboard_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

async function computeDashboard(institutionId: string, segment: string) {
  const allBranches = await prisma.branch.findMany({
    where: { institutionId },
    include: { advisor: { select: { firstName: true, lastName: true } } },
    orderBy: { grade: "asc" },
  });
  const branches = allBranches.filter((b) => branchMatchesSegment(b, segment));
  const branchIds = branches.map((b) => b.id);

  const students = await prisma.student.findMany({
    where: { branchId: { in: branchIds } },
    include: {
      branch: { select: { name: true } },
      netResults: { include: { exam: true } },
      attendanceRecords: { select: { status: true } },
      homeworkSubmissions: { select: { status: true } },
    },
  });

  const teachers = await prisma.teacher.findMany({
    where: { institutionId },
    include: { teachingBranches: { select: { id: true, name: true } } },
  });
  const staff = teachers
    .filter((t) => t.teachingBranches.some((b) => branchIds.includes(b.id)))
    .map((t) => ({
      id: t.id,
      name: `${t.firstName} ${t.lastName}`,
      subject: t.subject,
      branchNames: t.teachingBranches.filter((b) => branchIds.includes(b.id)).map((b) => b.name),
    }));

  // Öğrenci bazlı: güncel net (en son denemedeki branş netlerinin toplamı),
  // devam oranı, ödev tamamlama, risk skoru — hepsi gerçek sinyalden.
  const studentRows = students.map((s) => {
    const latestExamId = [...s.netResults].sort((a, b) => b.exam.examDate.getTime() - a.exam.examDate.getTime())[0]?.examId ?? null;
    const actualNet = latestExamId
      ? Math.round(s.netResults.filter((r) => r.examId === latestExamId).reduce((sum, r) => sum + r.net, 0) * 100) / 100
      : null;
    const attendanceRate = computeAttendanceRate(s.attendanceRecords);
    const homeworkTotal = s.homeworkSubmissions.length;
    const homeworkDone = s.homeworkSubmissions.filter((sub) => sub.status === "DONE").length;
    const homeworkSuccessRate = homeworkTotal === 0 ? null : Math.round((homeworkDone / homeworkTotal) * 100);
    const { riskScore, reason } = computeRisk({ attendanceRate, homeworkSuccessRate, nets: s.netResults.map((r) => r.net) });
    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      branchId: s.branchId,
      branch: s.branch.name,
      actualNet,
      homeworkTotal,
      homeworkDone,
      riskScore,
      riskReason: reason,
    };
  });

  const totalStudents = studentRows.length;
  const activeBranches = branches.length;
  const totalHomework = studentRows.reduce((sum, s) => sum + s.homeworkTotal, 0);
  const doneHomework = studentRows.reduce((sum, s) => sum + s.homeworkDone, 0);
  const avgCompletion = totalHomework === 0 ? 0 : Math.round((doneHomework / totalHomework) * 100);
  const riskyStudents = studentRows.filter((s) => s.riskScore >= 70).sort((a, b) => b.riskScore - a.riskScore);

  const branchRows = branches.map((b) => {
    const inBranch = studentRows.filter((s) => s.branchId === b.id);
    const hw = inBranch.reduce((sum, s) => sum + s.homeworkTotal, 0);
    const done = inBranch.reduce((sum, s) => sum + s.homeworkDone, 0);
    return {
      id: b.id,
      name: b.name,
      advisorName: b.advisor ? `${b.advisor.firstName} ${b.advisor.lastName}` : null,
      studentCount: inBranch.length,
      completionRate: hw === 0 ? 0 : Math.round((done / hw) * 100),
    };
  });

  // Sınav bazlı net trendi: "hedef" segmentin gerçek Student.targetNet
  // ortalaması (sabit referans çizgisi), "gerçekleşen" o sınavdaki gerçek
  // ortalama net — ikisi de gerçek veriden, uydurma aylık veri yok.
  const targets = students.map((s) => s.targetNet).filter((t): t is number => t !== null);
  const avgTarget = targets.length > 0 ? Math.round((targets.reduce((sum, t) => sum + t, 0) / targets.length) * 100) / 100 : null;

  const examMap = new Map<string, { name: string; examDate: Date; nets: number[] }>();
  for (const s of students) {
    for (const r of s.netResults) {
      const entry = examMap.get(r.examId) ?? { name: r.exam.name, examDate: r.exam.examDate, nets: [] };
      entry.nets.push(r.net);
      examMap.set(r.examId, entry);
    }
  }
  const examNetTrend = [...examMap.values()]
    .sort((a, b) => a.examDate.getTime() - b.examDate.getTime())
    .map((e) => ({
      examName: e.name,
      target: avgTarget,
      actual: Math.round((e.nets.reduce((sum, n) => sum + n, 0) / e.nets.length) * 100) / 100,
    }));

  const latestExamRow = await prisma.exam.findFirst({ where: { institutionId }, orderBy: { examDate: "desc" } });
  const latestExam = latestExamRow
    ? { name: latestExamRow.name, examDate: latestExamRow.examDate, resultCount: await prisma.examNetResult.count({ where: { examId: latestExamRow.id } }) }
    : null;

  return {
    totalStudents,
    activeBranches,
    avgCompletion,
    riskyStudentCount: riskyStudents.length,
    branches: branchRows,
    staff,
    students: studentRows.map((s) => ({ id: s.id, name: s.name, branch: s.branch, actualNet: s.actualNet })),
    riskyStudents: riskyStudents.map((s) => ({ id: s.id, name: s.name, branch: s.branch, riskScore: s.riskScore, reason: s.riskReason })),
    examNetTrend,
    latestExam,
  };
}

export const GET = withApiLogging("GET /api/admin/dashboard", handleGet);
