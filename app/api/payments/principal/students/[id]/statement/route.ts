import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { renderStatement } from "@/lib/server/payments/statement-render";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET /api/payments/principal/students/[id]/statement — öğrenci cari
// ekstresi PDF'i. Belge renderStatement() içinde üretilir; burada yalnızca
// yetki kontrolü var (aynı belge veli tarafından da indirilebilir).
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "COLLECTOR");

    const student = await prisma.student.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);

    const result = await renderStatement(params.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return new NextResponse(result.buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="ekstre-${result.studentNumber}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("student_statement_failed", error);
  }
}

export const GET = withApiLogging("GET /api/payments/principal/students/[id]/statement", handleGet);
