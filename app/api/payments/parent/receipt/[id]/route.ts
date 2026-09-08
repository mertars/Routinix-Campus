import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { renderReceipt } from "@/lib/server/payments/receipt-render";

export const dynamic = "force-dynamic";

// GET /api/payments/parent/receipt/[id] — velinin KENDİ ödemesinin makbuzu.
//
// Yönetici ucuyla AYNI belgeyi üretir (renderReceipt), yalnızca yetki
// kontrolü farklıdır: veli, kuruma değil ÖĞRENCİYE bağlıdır. Bu yüzden
// önce ödemenin hangi öğrenciye ait olduğunu bulup sahipliği
// assertParentOwnsStudent ile doğruluyoruz. Kurum kontrolü ayrıca gerekmez:
// veli-öğrenci bağı zaten tek bir kurumun içindedir.
//
// ⚠️ Sıra önemli: makbuz numarası ensureReceiptNo ile ÜRETİLDİĞİ için
// (yan etkili), yetki doğrulanmadan renderReceipt çağrılmamalıdır — aksi
// halde yetkisiz bir istek kurumun makbuz sayacını ilerletebilirdi.
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "parent");

    const payment = await prisma.payment.findUnique({ where: { id: params.id }, select: { studentId: true } });
    if (!payment) return NextResponse.json({ error: "Tahsilat bulunamadı." }, { status: 404 });
    await assertParentOwnsStudent(session.sub, payment.studentId);

    const result = await renderReceipt(params.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return new NextResponse(result.buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="makbuz-${result.receiptNo}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("parent_receipt_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/parent/receipt/[id]", handleGet);
