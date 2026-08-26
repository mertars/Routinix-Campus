import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { computeAttendanceRate } from "@/lib/server/report-card/analyzer";
import { computeRisk } from "@/lib/server/risk/compute-risk";
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

async function computeRiskRadar(institutionId: string, teacherId: string | null) {
  let branchIds: string[] | null = null;
  if (teacherId) {
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, include: { teachingBranches: { select: { id: true } } } });
    branchIds = teacher && teacher.institutionId === institutionId ? teacher.teachingBranches.map((b) => b.id) : [];
  }

  const students = await prisma.student.findMany({
    where: branchIds ? { branchId: { in: branchIds } } : { institutionId },
    include: {
      branch: { select: { name: true } },
      netResults: { include: { exam: true }, orderBy: { exam: { examDate: "asc" } } },
      attendanceRecords: { select: { status: true } },
      homeworkSubmissions: { select: { status: true } },
    },
  });

  const entries = students.map((student) => {
    const attendanceRate = computeAttendanceRate(student.attendanceRecords);
    const homeworkTotal = student.homeworkSubmissions.length;
    const homeworkDone = student.homeworkSubmissions.filter((s) => s.status === "DONE").length;
    const homeworkSuccessRate = homeworkTotal === 0 ? null : Math.round((homeworkDone / homeworkTotal) * 100);
    const { riskScore, reason } = computeRisk({
      attendanceRate,
      homeworkSuccessRate,
      nets: student.netResults.map((r) => r.net),
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
