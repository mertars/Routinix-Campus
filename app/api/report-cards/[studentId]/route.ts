import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { generateReportCardPdf } from "@/lib/server/report-card/report-card-service";
import { requireSession, requireInstitution, assertOwnsSelf, assertTeacherOwnsStudent, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

// GET /api/report-cards/:studentId?donem=2025-2026%201.%20D%C3%B6nem
// Öğrencinin son deneme netlerini sınıf ortalamasıyla kıyaslayıp, devam
// oranını hesaplayıp, kural bazlı rehberlik notlarıyla birlikte A4 PDF
// üretir ve doğrudan Buffer olarak döner (application/pdf). Tam bir karne
// PDF'i olduğu için erişim students/[id] ile BİREBİR aynı sahiplik kuralına
// tabidir (öğrencinin kendisi / danışman-branş öğretmeni / velisi / yönetici).
async function handleGet(request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();

    const student = await prisma.student.findUnique({ where: { id: params.studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, params.studentId);
    else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, params.studentId);
    else if (session.role === "PARENT") await assertParentOwnsStudent(session.sub, params.studentId);

    const periodLabel = request.nextUrl.searchParams.get("donem") ?? "Güncel Dönem";
    const pdfBuffer = await generateReportCardPdf(params.studentId, periodLabel);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="karne-${params.studentId}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    const status = message === "Öğrenci bulunamadı." ? 404 : 500;
    if (status === 500) logger.error("report_card_generation_failed", { studentId: params.studentId, error: message });
    return NextResponse.json({ error: message }, { status });
  }
}

export const GET = withApiLogging("GET /api/report-cards/[studentId]", handleGet);
