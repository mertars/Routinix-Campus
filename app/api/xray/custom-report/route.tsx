import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { buildRoadmapForSubject } from "@/lib/server/xray/roadmap";
import { computePlacementProgress } from "@/lib/server/xray/placement-progress";
import { computeOverallTrend } from "@/lib/server/xray/mastery-trend";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { PdfXrayCustomReport, type ResolvedBlock } from "@/components/pdf/pdf-xray-custom-report";
import { requireSession, requireInstitution, assertOwnsSelf, assertTeacherOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type BlockSpec =
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "summary" }
  | { type: "subtopicScan"; subtopicIds: string[] | null }
  | { type: "trend"; from: string | null; to: string | null }
  | { type: "doubleExposure" }
  | { type: "branchAverage"; branchId: string }
  | { type: "history"; subtopicIds: string[] | null; from: string | null; to: string | null };

function subtopicNameMap(subject: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const topic of CURRICULUM_TREE[subject] ?? []) {
    for (const sub of topic.subtopics) map.set(sub.id, sub.name);
  }
  return map;
}

// POST /api/xray/custom-report — { studentId, subject, blocks } — "Özel PDF
// Oluşturucu". Kullanıcı talebi: yönetici istediği konuların istediği
// tarihteki grafiklerini/yazıları KENDİ SIRASINDA ekleyip AYNI uca hem
// canlı önizleme (debounce'lı POST → iframe) hem final indirme/paylaşma
// için gönderir — tutarsızlık riski yok, İKİSİ DE aynı PDF'i üretir.
// Sahiplik kuralı /api/xray/report/[studentId] ile AYNI, PARENT hariç
// (özel rapor oluşturmak bir yönetim eylemi).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();

    const body = await request.json().catch(() => null);
    const { studentId, subject, blocks } = (body ?? {}) as { studentId?: string; subject?: string; blocks?: BlockSpec[] };
    if (!studentId || !subject?.trim() || !Array.isArray(blocks)) {
      return NextResponse.json({ error: "studentId, subject ve blocks zorunludur." }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { firstName: true, lastName: true, institutionId: true, branch: { select: { name: true } } },
    });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, studentId);
    else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, studentId);
    else if (session.role === "PARENT") return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });

    const institution = await prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } });
    const nameById = subtopicNameMap(subject);

    let roadmapCache: Awaited<ReturnType<typeof buildRoadmapForSubject>> | null = null;
    async function roadmap() {
      if (!roadmapCache) roadmapCache = await buildRoadmapForSubject(studentId!, subject!);
      return roadmapCache;
    }

    const resolved: ResolvedBlock[] = [];
    for (const spec of blocks) {
      if (spec.type === "heading" || spec.type === "text") {
        resolved.push(spec);
        continue;
      }
      if (spec.type === "summary") {
        const r = await roadmap();
        resolved.push({ type: "summary", summary: r.summary, recommendationCount: r.recommendations.length });
        continue;
      }
      if (spec.type === "subtopicScan") {
        const r = await roadmap();
        const recs = spec.subtopicIds ? r.recommendations.filter((x) => spec.subtopicIds!.includes(x.subtopicId)) : r.recommendations;
        resolved.push({ type: "subtopicScan", recommendations: recs });
        continue;
      }
      if (spec.type === "trend") {
        const history = await prisma.topicMasteryHistory.findMany({
          where: {
            studentId,
            subject,
            ...(spec.from ? { assessedAt: { gte: new Date(spec.from) } } : {}),
            ...(spec.to ? { assessedAt: { lte: new Date(spec.to) } } : {}),
          },
          select: { subtopicId: true, masteryScore: true, assessedAt: true },
        });
        const points = computeOverallTrend(history).map((p) => ({ assessedAt: p.assessedAt, average: p.average }));
        resolved.push({ type: "trend", points });
        continue;
      }
      if (spec.type === "doubleExposure") {
        const progress = await computePlacementProgress(studentId, subject);
        if (progress.hasPlacement) {
          resolved.push({
            type: "doubleExposure",
            before: { avg: progress.before.avg, assessedAt: progress.before.assessedAt.toISOString() },
            after: { avg: progress.after.avg, assessedAt: progress.after.assessedAt.toISOString() },
          });
        }
        continue;
      }
      if (spec.type === "branchAverage") {
        const [branch, byStudent] = await Promise.all([
          prisma.branch.findUnique({ where: { id: spec.branchId }, select: { name: true } }),
          prisma.topicMasteryAssessment.groupBy({ by: ["studentId"], where: { subject, student: { branchId: spec.branchId } }, _avg: { masteryScore: true } }),
        ]);
        if (branch && byStudent.length > 0) {
          const branchAverage = Math.round(byStudent.reduce((sum, r) => sum + (r._avg.masteryScore ?? 0), 0) / byStudent.length);
          const studentAvgRow = byStudent.find((r) => r.studentId === studentId);
          const studentAverage = studentAvgRow ? Math.round(studentAvgRow._avg.masteryScore ?? 0) : branchAverage;
          resolved.push({ type: "branchAverage", branchName: branch.name, branchAverage, studentAverage });
        }
        continue;
      }
      if (spec.type === "history") {
        const rows = await prisma.topicMasteryHistory.findMany({
          where: {
            studentId,
            subject,
            ...(spec.subtopicIds ? { subtopicId: { in: spec.subtopicIds } } : {}),
            ...(spec.from ? { assessedAt: { gte: new Date(spec.from) } } : {}),
            ...(spec.to ? { assessedAt: { lte: new Date(spec.to) } } : {}),
          },
          orderBy: { assessedAt: "desc" },
          select: { subtopicId: true, masteryScore: true, assessedAt: true },
        });
        resolved.push({
          type: "history",
          rows: rows.map((r) => ({ assessedAt: r.assessedAt.toISOString(), subtopicName: nameById.get(r.subtopicId) ?? r.subtopicId, masteryScore: r.masteryScore })),
        });
        continue;
      }
    }

    const pdfBuffer = await renderToBuffer(
      <PdfXrayCustomReport
        institutionName={institution?.name ?? ""}
        logoUrl={institution?.logoUrl}
        studentName={`${student.firstName} ${student.lastName}`}
        branchName={student.branch.name}
        subject={subject}
        generatedAtLabel={new Date().toLocaleDateString("tr-TR")}
        blocks={resolved}
      />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="ozel-rontgen-raporu-${studentId}.pdf"` },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_custom_report_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/custom-report", handlePost);
