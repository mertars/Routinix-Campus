import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { PdfExamDocument, type PdfExamSeat } from "@/components/pdf/pdf-exam-document";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/exam-seating/pdf — { mode, hall, examName, examDate, seat?, seats? }
// Yönetici panelindeki Kelebek Sınav Oturma Planı'nın "Sınav Giriş Belgesi"
// (tekil) ve "Salon Kapı Listesi" (toplu) çıktıları.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { mode, hall, examName, examDate, seat, seats } = body as {
      mode?: "entry" | "doorList";
      hall?: string;
      examName?: string;
      examDate?: string;
      seat?: PdfExamSeat;
      seats?: PdfExamSeat[];
    };
    if (mode !== "entry" && mode !== "doorList") {
      return NextResponse.json({ error: "mode 'entry' veya 'doorList' olmalı." }, { status: 400 });
    }
    if (!hall?.trim() || !examName?.trim() || !examDate?.trim()) {
      return NextResponse.json({ error: "hall, examName ve examDate zorunludur." }, { status: 400 });
    }
    if (mode === "entry" && !seat) {
      return NextResponse.json({ error: "entry modu için seat zorunludur." }, { status: 400 });
    }

    const institution = await prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } });

    const pdfBuffer = await renderToBuffer(
      <PdfExamDocument
        institutionName={institution?.name ?? ""}
        logoUrl={institution?.logoUrl}
        mode={mode}
        hall={hall}
        examName={examName}
        examDate={examDate}
        seat={seat}
        seats={seats ?? []}
      />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${mode === "entry" ? "sinav-giris-belgesi" : "salon-kapi-listesi"}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_seating_pdf_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/exam-seating/pdf", handlePost);
