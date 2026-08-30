import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { PdfTeacherSchedule, type PdfScheduleRow } from "@/components/pdf/pdf-teacher-schedule";
import { SCHEDULE_DAYS } from "@/lib/mock-data";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/teacher-schedule/pdf — { teacherName, subject, schedule } —
// öğretmen panelindeki "Haftalık Program" ekranının PDF çıktısı.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");

    const body = await request.json();
    const { teacherName, subject, schedule } = body as { teacherName?: string; subject?: string; schedule?: PdfScheduleRow[] };
    if (!teacherName?.trim() || !subject?.trim() || !Array.isArray(schedule)) {
      return NextResponse.json({ error: "teacherName, subject ve schedule zorunludur." }, { status: 400 });
    }

    const institution = await prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } });

    const pdfBuffer = await renderToBuffer(
      <PdfTeacherSchedule
        institutionName={institution?.name ?? ""}
        logoUrl={institution?.logoUrl}
        teacherName={teacherName}
        subject={subject}
        days={SCHEDULE_DAYS}
        schedule={schedule}
      />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="haftalik-program.pdf"` },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("teacher_schedule_pdf_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/teacher-schedule/pdf", handlePost);
