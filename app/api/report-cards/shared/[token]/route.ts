import { NextResponse } from "next/server";
import { resolveReportCardShareLink } from "@/lib/server/report-card/share-link";
import { generateReportCardPdf } from "@/lib/server/report-card/report-card-service";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/report-cards/shared/:token — BİLEREK requireSession() İÇERMEZ,
// bu ucun TÜM amacı oturum açmadan (WhatsApp/SMS ile paylaşılan bir link
// üzerinden) karneye erişebilmek. Tek kimlik doğrulaması token'ın kendisi
// — bkz. lib/server/report-card/share-link.ts.
async function handleGet(request: Request, { params }: { params: { token: string } }) {
  try {
    const resolution = await resolveReportCardShareLink(params.token);
    if (!resolution.ok) {
      const message = resolution.reason === "EXPIRED" ? "Bu paylaşım linkinin süresi dolmuş." : "Geçersiz paylaşım linki.";
      return NextResponse.json({ error: message }, { status: resolution.reason === "EXPIRED" ? 410 : 404 });
    }

    const pdfBuffer = await generateReportCardPdf(resolution.studentId, resolution.periodLabel);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="karne-${resolution.studentId}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    logger.error("report_card_shared_view_failed", { token: params.token, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/report-cards/shared/[token]", handleGet);
