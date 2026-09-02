import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { getInstitutionOverview } from "@/lib/server/xray/institution-overview";
import { PdfXrayScopeReport, type PdfScopeReportRow } from "@/components/pdf/pdf-xray-scope-report";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/institution-report?subject=&grade= — "Genel Bakış"
// panelinin PDF çıktısı. `grade` verilmezse KURUM GENELİ (satırlar =
// sınıf seviyeleri), verilirse O SINIF SEVİYESİ (satırlar = şubeler).
// Veriler ZATEN getInstitutionOverview'in hesapladığı AYNI sayılar —
// burada sadece PDF'e döküyor, yeniden hesaplama YOK.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const subject = request.nextUrl.searchParams.get("subject");
    if (!subject?.trim()) return NextResponse.json({ error: "subject parametresi zorunludur." }, { status: 400 });
    const gradeParam = request.nextUrl.searchParams.get("grade");
    const grade = gradeParam ? Number(gradeParam) : null;

    const [overview, institution] = await Promise.all([
      getInstitutionOverview(session.institutionId, subject),
      prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } }),
    ]);

    let scopeTitle: string;
    let rowLabelHeader: string;
    let summary: { average: number | null; studentCount: number; testedCount: number; redZoneCount: number };
    let rows: PdfScopeReportRow[];
    let fileSuffix: string;

    if (grade === null) {
      scopeTitle = "Kurum Geneli";
      rowLabelHeader = "SINIF SEVİYESİ";
      summary = overview;
      rows = overview.grades.map((g) => ({ label: `${g.grade}. Sınıf`, studentCount: g.studentCount, testedCount: g.testedCount, average: g.average, redZoneCount: g.redZoneCount }));
      fileSuffix = "kurum-geneli";
    } else {
      const gradeData = overview.grades.find((g) => g.grade === grade);
      if (!gradeData) return NextResponse.json({ error: "Bu sınıf seviyesi bulunamadı." }, { status: 404 });
      scopeTitle = `${grade}. Sınıf`;
      rowLabelHeader = "ŞUBE";
      summary = gradeData;
      rows = gradeData.branches.map((b) => ({ label: b.branchName, studentCount: b.studentCount, testedCount: b.testedCount, average: b.average, redZoneCount: b.redZoneCount }));
      fileSuffix = `${grade}-sinif`;
    }

    const pdfBuffer = await renderToBuffer(
      <PdfXrayScopeReport
        institutionName={institution?.name ?? ""}
        logoUrl={institution?.logoUrl}
        scopeTitle={scopeTitle}
        subject={subject}
        rowLabelHeader={rowLabelHeader}
        generatedAtLabel={new Date().toLocaleDateString("tr-TR")}
        summary={summary}
        rows={rows}
      />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="genel-bakis-${fileSuffix}.pdf"` },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_institution_report_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/institution-report", handleGet);
