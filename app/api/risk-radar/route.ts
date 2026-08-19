import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { computeAttendanceRate } from "@/lib/server/report-card/analyzer";
import { computeRisk } from "@/lib/server/risk/compute-risk";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/risk-radar  veya  ?teacherId=X — RISK_RADAR mock'unun yerini,
// gerçek devam/net-trend/ödev sinyallerinden türetilen risk skoru alır
// (bkz. lib/server/risk/compute-risk.ts). ?teacherId= verilirse SADECE o
// öğretmenin ders verdiği şubelerdeki öğrenciler döner (Rehberlik Sevk
// ekranı); verilmezse kurum geneli (Yönetici Risk Radarı).
async function handleGet(request: NextRequest) {
  try {
    const teacherId = request.nextUrl.searchParams.get("teacherId");

    let branchIds: string[] | null = null;
    if (teacherId) {
      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, include: { teachingBranches: { select: { id: true } } } });
      branchIds = teacher ? teacher.teachingBranches.map((b) => b.id) : [];
    }

    const students = await prisma.student.findMany({
      where: branchIds ? { branchId: { in: branchIds } } : {},
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

    return NextResponse.json({ entries });
  } catch (error) {
    logger.error("risk_radar_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/risk-radar", handleGet);
