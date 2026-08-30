import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE, XRAY_MIN_GRADE } from "@/lib/mock-data";
import { PdfXrayBranchReport, type PdfBranchReportRow } from "@/components/pdf/pdf-xray-branch-report";
import { requireSession, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/branch-report?branchId=X&subject=Matematik — "Veli
// Toplantısı Raporu": bir şubenin TAMAMI için TEK bir PDF (bkz.
// pdf-xray-branch-report.tsx'teki tasarım gerekçesi). Yönetici HER
// şubeye erişebilir; öğretmen SADECE danışmanı olduğu ya da ders verdiği
// şubeye (assertTeacherOwnsStudent'taki AYNI 2 yol, ama öğrenci değil
// ŞUBE düzeyinde — tek çağıran olduğu için ayrı bir paylaşılan yardımcıya
// gerek görülmedi).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "ADMIN" && session.role !== "TEACHER") {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    }

    const branchId = request.nextUrl.searchParams.get("branchId");
    const subject = request.nextUrl.searchParams.get("subject");
    if (!branchId || !subject?.trim()) return NextResponse.json({ error: "branchId ve subject parametreleri zorunludur." }, { status: 400 });

    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, name: true, institutionId: true, advisorId: true } });
    if (!branch) return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    requireInstitution(session, branch.institutionId);
    if (session.role === "TEACHER") {
      const owns = await prisma.branch.findFirst({
        where: { id: branchId, OR: [{ advisorId: session.sub }, { teachingStaff: { some: { id: session.sub } } }] },
        select: { id: true },
      });
      if (!owns) return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    }

    const [institution, students] = await Promise.all([
      prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } }),
      prisma.student.findMany({
        where: { branchId, isActive: true },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }],
      }),
    ]);

    const subtopicNameById = new Map<string, string>();
    let totalSubtopicCount = 0;
    for (const topic of CURRICULUM_TREE[subject] ?? []) {
      if (topic.grade < XRAY_MIN_GRADE) continue;
      for (const sub of topic.subtopics) {
        subtopicNameById.set(sub.id, sub.name);
        totalSubtopicCount++;
      }
    }

    const assessments = await prisma.topicMasteryAssessment.findMany({
      where: { studentId: { in: students.map((s) => s.id) }, subject },
      select: { studentId: true, subtopicId: true, masteryScore: true },
    });
    const byStudent = new Map<string, { subtopicId: string; masteryScore: number }[]>();
    for (const a of assessments) {
      const list = byStudent.get(a.studentId) ?? [];
      list.push({ subtopicId: a.subtopicId, masteryScore: a.masteryScore });
      byStudent.set(a.studentId, list);
    }

    const rows: PdfBranchReportRow[] = students.map((s) => {
      const scores = byStudent.get(s.id) ?? [];
      const averageScore = scores.length === 0 ? null : Math.round(scores.reduce((sum, x) => sum + x.masteryScore, 0) / scores.length);
      const redZone = scores.filter((x) => x.masteryScore < 30);
      const weakest = [...scores].sort((a, b) => a.masteryScore - b.masteryScore)[0];
      return {
        studentName: `${s.firstName} ${s.lastName}`,
        averageScore,
        testedCount: scores.length,
        totalCount: totalSubtopicCount,
        redZoneCount: redZone.length,
        weakestSubtopicName: weakest ? subtopicNameById.get(weakest.subtopicId) ?? weakest.subtopicId : null,
      };
    });

    const pdfBuffer = await renderToBuffer(
      <PdfXrayBranchReport
        institutionName={institution?.name ?? ""}
        logoUrl={institution?.logoUrl}
        branchName={branch.name}
        subject={subject}
        generatedAtLabel={new Date().toLocaleDateString("tr-TR")}
        rows={rows}
      />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="veli-toplantisi-${branch.name}.pdf"` },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_branch_report_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/branch-report", handleGet);
