import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { generateXrayRecommendations, summarizeXrayDiagnosis } from "@/lib/server/xray/recommendations";
import { PdfXrayReport } from "@/components/pdf/pdf-xray-report";
import { requireSession, requireInstitution, assertOwnsSelf, assertTeacherOwnsStudent, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/report/[studentId]?subject=Matematik — Akademik Röntgen
// Raporu PDF'i. Sahiplik kuralı GET /api/xray/results/[studentId] ile
// BİREBİR aynı (öğrencinin kendisi/danışman-branş öğretmeni/velisi/yönetici).
async function handleGet(request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();

    const student = await prisma.student.findUnique({
      where: { id: params.studentId },
      select: { firstName: true, lastName: true, institutionId: true, branch: { select: { name: true } } },
    });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, params.studentId);
    else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, params.studentId);
    else if (session.role === "PARENT") await assertParentOwnsStudent(session.sub, params.studentId);

    const subject = request.nextUrl.searchParams.get("subject");
    if (!subject?.trim()) return NextResponse.json({ error: "subject parametresi zorunludur." }, { status: 400 });

    const [institution, assessments] = await Promise.all([
      prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } }),
      prisma.topicMasteryAssessment.findMany({ where: { studentId: params.studentId, subject }, select: { subtopicId: true, masteryScore: true } }),
    ]);

    const subtopicNameById = new Map<string, string>();
    for (const topic of CURRICULUM_TREE[subject] ?? []) {
      for (const sub of topic.subtopics) subtopicNameById.set(sub.id, sub.name);
    }
    const diagnoses = assessments.map((a) => ({ subtopicId: a.subtopicId, name: subtopicNameById.get(a.subtopicId) ?? a.subtopicId, masteryScore: a.masteryScore }));
    const recommendations = generateXrayRecommendations(diagnoses);
    const summary = summarizeXrayDiagnosis(recommendations);

    const pdfBuffer = await renderToBuffer(
      <PdfXrayReport
        institutionName={institution?.name ?? ""}
        logoUrl={institution?.logoUrl}
        studentName={`${student.firstName} ${student.lastName}`}
        branchName={student.branch.name}
        subject={subject}
        generatedAtLabel={new Date().toLocaleDateString("tr-TR")}
        recommendations={recommendations}
        summary={summary}
      />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="rontgen-raporu-${params.studentId}.pdf"` },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_report_failed", { studentId: params.studentId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/report/[studentId]", handleGet);
