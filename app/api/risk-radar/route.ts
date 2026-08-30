import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { computeRisk } from "@/lib/server/risk/compute-risk";
import { buildStatusCountMap } from "@/lib/server/risk/status-count-map";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withTtlCache } from "@/lib/server/cache/ttl-cache";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Kurum genelinde (teacherId'siz) çağrıldığında TÜM öğrenci rosterini
// net/devam/ödev geçmişiyle tarayan pahalı bir agregasyon — bkz. FAZ 6
// planı > kısa TTL cache.
const RISK_RADAR_CACHE_TTL_MS = 20_000;

// GET /api/risk-radar  veya  ?teacherId=X — RISK_RADAR mock'unun yerini,
// gerçek devam/net-trend/ödev sinyallerinden türetilen risk skoru alır
// (bkz. lib/server/risk/compute-risk.ts). ?teacherId= verilirse SADECE o
// öğretmenin ders verdiği şubelerdeki öğrenciler döner (Rehberlik Sevk
// ekranı); verilmezse kurum geneli (Yönetici Risk Radarı).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const teacherId = request.nextUrl.searchParams.get("teacherId");

    if (teacherId) {
      if (session.role === "TEACHER") {
        if (session.sub !== teacherId) throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
      } else {
        requireRole(session, "principal");
      }
    } else {
      requireRole(session, "principal");
    }

    const entries = await withTtlCache(
      `risk-radar:${session.institutionId}:${teacherId ?? "ALL"}`,
      RISK_RADAR_CACHE_TTL_MS,
      () => computeRiskRadar(session.institutionId, teacherId)
    );

    return NextResponse.json({ entries });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("risk_radar_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// ⚠️ attendanceRecords/homeworkSubmissions önceden HER öğrenci için tam
// geçmişiyle çekilip computeAttendanceRate ile satır satır JS'te
// indirgeniyordu (bkz. app/api/admin/dashboard/route.ts'teki AYNI düzeltme,
// aynı gerekçe) — büyük kurumlarda öğrenci başına yüzlerce devam/ödev
// satırı anlamına geliyordu. Sadece ORAN gerektiği için ham satırlar
// yerine groupBy ile öğrenci başına durum sayıları çekiliyor.
async function computeRiskRadar(institutionId: string, teacherId: string | null) {
  let branchIds: string[] | null = null;
  if (teacherId) {
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, include: { teachingBranches: { select: { id: true } } } });
    branchIds = teacher && teacher.institutionId === institutionId ? teacher.teachingBranches.map((b) => b.id) : [];
  }

  const studentWhere = branchIds ? { branchId: { in: branchIds } } : { institutionId };
  // ⚠️ attendance/homework sorguları artık ÖNCE öğrencileri çekip id
  // listesine indirgemeyi BEKLEMİYOR — aynı studentWhere koşulunu
  // `student: {...}` ilişki filtresiyle doğrudan uyguluyor, bu yüzden
  // öğrenci sorgusuyla AYNI Promise.all turunda, tek round-trip'te
  // çalışabiliyor (bkz. app/api/admin/dashboard/route.ts'teki AYNI
  // gerekçe/desen — sıralı aşama sayısı, satır hacminden bağımsız gerçek
  // bir gecikme kaynağıydı).
  const [students, attendanceCounts, homeworkCounts, masteryAverages] = await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        branch: { select: { name: true } },
        netResults: { select: { net: true }, orderBy: { exam: { examDate: "asc" } } },
      },
    }),
    prisma.attendanceRecord.groupBy({ by: ["studentId", "status"], where: { student: studentWhere }, _count: true }),
    prisma.homeworkSubmission.groupBy({ by: ["studentId", "status"], where: { student: studentWhere }, _count: true }),
    // Faz O — Akademik Röntgen "3. sistem" sinyali (bkz. compute-risk.ts).
    prisma.topicMasteryAssessment.groupBy({ by: ["studentId"], where: { student: studentWhere }, _avg: { masteryScore: true } }),
  ]);

  const attendanceByStudent = buildStatusCountMap(attendanceCounts, ["PRESENT", "LATE"]);
  const homeworkByStudent = buildStatusCountMap(homeworkCounts, ["DONE"]);
  const masteryAvgByStudent = new Map(masteryAverages.map((m) => [m.studentId, m._avg.masteryScore ?? null]));

  const entries = students.map((student) => {
    const att = attendanceByStudent.get(student.id);
    const attendanceRate = att && att.total > 0 ? Math.round((att.positive / att.total) * 100) : 100;
    const hw = homeworkByStudent.get(student.id);
    const homeworkTotal = hw?.total ?? 0;
    const homeworkDone = hw?.positive ?? 0;
    const homeworkSuccessRate = homeworkTotal === 0 ? null : Math.round((homeworkDone / homeworkTotal) * 100);
    const avgMastery = masteryAvgByStudent.get(student.id);
    const { riskScore, reason } = computeRisk({
      attendanceRate,
      homeworkSuccessRate,
      nets: student.netResults.map((r) => r.net),
      masteryScores: avgMastery !== null && avgMastery !== undefined ? [avgMastery] : [],
    });
    return {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      branch: student.branch.name,
      riskScore,
      reason,
    };
  });

  entries.sort((a, b) => b.riskScore - a.riskScore);
  return entries;
}

export const GET = withApiLogging("GET /api/risk-radar", handleGet);
