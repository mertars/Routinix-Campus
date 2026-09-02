import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { requireSession, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/branch-average?branchId=&subject= — "Şube Ortalamaları"
// paneli. Yetki deseni app/api/xray/branch-report/route.tsx ile BİREBİR
// aynı (ADMIN her şubeye, TEACHER sadece danışmanı/ders verdiği şubeye).
// Kullanıcı isteği: "sınıf ortalamasını ekle ama sınıflara özel ayrı
// panel gerekir" — bu yüzden tek bir sayı değil, kurumun ZATEN kullandığı
// groupBy+_avg deseniyle (bkz. app/api/admin/dashboard/route.ts satır 113)
// hem şube ortalaması hem konu bazlı kırılım hem öğrenci listesi (İSİM
// SIRALAMASI/liderlik tablosu YOK, sadece kendi delta'sını görür — "akran
// kıyaslaması yok" ilkesi korunur) TEK istekte döner.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "ADMIN" && session.role !== "TEACHER") {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    }

    const branchId = request.nextUrl.searchParams.get("branchId");
    const subject = request.nextUrl.searchParams.get("subject");
    if (!branchId || !subject?.trim()) return NextResponse.json({ error: "branchId ve subject parametreleri zorunludur." }, { status: 400 });

    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, name: true, institutionId: true } });
    if (!branch) return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    requireInstitution(session, branch.institutionId);
    if (session.role === "TEACHER") {
      const owns = await prisma.branch.findFirst({
        where: { id: branchId, OR: [{ advisorId: session.sub }, { teachingStaff: { some: { id: session.sub } } }] },
        select: { id: true },
      });
      if (!owns) return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    }

    const [students, byStudent, bySubtopic] = await Promise.all([
      prisma.student.findMany({ where: { branchId, isActive: true }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } }),
      prisma.topicMasteryAssessment.groupBy({ by: ["studentId"], where: { subject, student: { branchId } }, _avg: { masteryScore: true } }),
      prisma.topicMasteryAssessment.groupBy({ by: ["subtopicId"], where: { subject, student: { branchId } }, _avg: { masteryScore: true }, _count: true }),
    ]);

    const avgByStudent = new Map(byStudent.map((r) => [r.studentId, Math.round(r._avg.masteryScore ?? 0)]));
    const testedStudents = students.filter((s) => avgByStudent.has(s.id));
    const branchAverage = testedStudents.length === 0 ? 0 : Math.round(testedStudents.reduce((sum, s) => sum + (avgByStudent.get(s.id) ?? 0), 0) / testedStudents.length);

    const subtopicNameById = new Map<string, string>();
    for (const topic of CURRICULUM_TREE[subject] ?? []) {
      for (const sub of topic.subtopics) subtopicNameById.set(sub.id, sub.name);
    }
    const subtopicBreakdown = bySubtopic
      .map((r) => ({ subtopicId: r.subtopicId, name: subtopicNameById.get(r.subtopicId) ?? r.subtopicId, average: Math.round(r._avg.masteryScore ?? 0) }))
      .sort((a, b) => a.average - b.average);

    const studentRows = students.map((s) => {
      const average = avgByStudent.get(s.id) ?? null;
      return { studentId: s.id, name: `${s.firstName} ${s.lastName}`, average, delta: average === null ? null : average - branchAverage };
    });

    return NextResponse.json({
      branchName: branch.name,
      branchAverage,
      studentCount: students.length,
      testedCount: testedStudents.length,
      subtopicBreakdown,
      students: studentRows,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_branch_average_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/branch-average", handleGet);
