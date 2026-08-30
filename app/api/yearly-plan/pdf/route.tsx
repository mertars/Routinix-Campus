import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { PdfYearlyPlan, type PdfYearlyPlanRow } from "@/components/pdf/pdf-yearly-plan";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/yearly-plan/pdf — { teacherName, subject, rows } — öğretmen
// panelindeki "Sınıf Defteri & Yıllık Plan" ekranındaki "Kurumsal A4 PDF
// Çıktısı Al" özelliği. teacherName/subject/rows çağıran tarafta zaten
// (useTeacherScope + myPlan) mevcut olduğu için doğrudan gövdede gönderilir
// — sadece kurum adı/logosu sunucuda oturumdan çözülür.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");

    const body = await request.json();
    const { teacherName, subject, rows } = body as { teacherName?: string; subject?: string; rows?: PdfYearlyPlanRow[] };
    if (!teacherName?.trim() || !subject?.trim() || !Array.isArray(rows)) {
      return NextResponse.json({ error: "teacherName, subject ve rows zorunludur." }, { status: 400 });
    }

    const institution = await prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } });

    const pdfBuffer = await renderToBuffer(
      <PdfYearlyPlan institutionName={institution?.name ?? ""} logoUrl={institution?.logoUrl} teacherName={teacherName} subject={subject} rows={rows} />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="yillik-plan.pdf"` },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("yearly_plan_pdf_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/yearly-plan/pdf", handlePost);
