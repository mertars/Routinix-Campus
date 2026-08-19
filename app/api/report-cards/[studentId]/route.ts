import { NextRequest, NextResponse } from "next/server";
import { generateReportCardPdf } from "@/lib/server/report-card/report-card-service";
import { withApiLogging, logger } from "@/lib/logger";

// GET /api/report-cards/:studentId?donem=2025-2026%201.%20D%C3%B6nem
// Öğrencinin son deneme netlerini sınıf ortalamasıyla kıyaslayıp, devam
// oranını hesaplayıp, kural bazlı rehberlik notlarıyla birlikte A4 PDF
// üretir ve doğrudan Buffer olarak döner (application/pdf).
async function handleGet(request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
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
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    const status = message === "Öğrenci bulunamadı." ? 404 : 500;
    if (status === 500) logger.error("report_card_generation_failed", { studentId: params.studentId, error: message });
    return NextResponse.json({ error: message }, { status });
  }
}

export const GET = withApiLogging("GET /api/report-cards/[studentId]", handleGet);
