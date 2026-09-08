import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";

export const dynamic = "force-dynamic";

// GET /api/payments/principal/students — Ödeme Takip'in öğrenci seçici
// dropdown'ı için kurumun TAM rosteri (bkz. /api/students — o uç branchId
// zorunlu kılıyor, burada tek bir öğrenciyi isimle arayabilmek için şube
// filtresi olmadan tüm kurum listeleniyor).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "COLLECTOR");

    const students = await prisma.student.findMany({
      where: { institutionId: session.institutionId, isActive: true },
      select: { id: true, firstName: true, lastName: true, branch: { select: { name: true, grade: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return NextResponse.json({
      students: students.map((s) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, branchName: s.branch.name, grade: s.branch.grade })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("payment_students_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/students", handleGet);
