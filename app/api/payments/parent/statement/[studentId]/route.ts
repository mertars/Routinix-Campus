import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireRole, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { renderStatement } from "@/lib/server/payments/statement-render";

export const dynamic = "force-dynamic";

// GET /api/payments/parent/statement/[studentId] — velinin KENDİ çocuğunun
// cari ekstresi. Yönetici ucuyla AYNI belgeyi üretir, yalnızca yetki
// kontrolü sahiplik üzerinden yapılır.
async function handleGet(_request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "parent");
    await assertParentOwnsStudent(session.sub, params.studentId);

    const result = await renderStatement(params.studentId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return new NextResponse(result.buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="ekstre-${result.studentNumber}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("parent_statement_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/parent/statement/[studentId]", handleGet);
