import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { PdfGuidanceProgram, type GuidanceProgramEntryRow } from "@/components/pdf/pdf-guidance-program";
import { DAYS_OF_WEEK } from "@/lib/mock-data";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/guidance-program/pdf — { studentId, weekLabel, entries }
// "Kurumsal A4 PDF Çıktısı Al" (bkz. components/principal/tabs/guidance-program.tsx)
// hem henüz kaydedilmemiş taslağı (draftEntries) hem de geçmişten seçilmiş
// kayıtlı bir programı (previewProgram.entries) AYNI şekilde besler — bu
// yüzden ID ile DB'den çekmek yerine entries doğrudan gövdede gönderilir.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { studentId, weekLabel, entries } = body as {
      studentId?: string;
      weekLabel?: string;
      entries?: GuidanceProgramEntryRow[];
    };
    if (!studentId || !weekLabel?.trim() || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "studentId, weekLabel ve en az bir entry zorunludur." }, { status: 400 });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true, institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);

    const institution = await prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } });

    const pdfBuffer = await renderToBuffer(
      <PdfGuidanceProgram
        institutionName={institution?.name ?? ""}
        logoUrl={institution?.logoUrl}
        studentName={`${student.firstName} ${student.lastName}`}
        weekLabel={weekLabel.trim()}
        days={DAYS_OF_WEEK}
        entries={entries}
      />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="calisma-programi-${studentId}.pdf"` },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("guidance_program_pdf_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/guidance-program/pdf", handlePost);
