import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// Kurumun "kaç kişiyiz" sayıları — TEK kaynak.
//
// Bu uç var çünkü sayılar ekran ekran ayrı ayrı hesaplanıyordu ve
// hepsi aynı kuralı uygulamıyordu (kimi pasifleri de sayıyordu).
// Ekranların kendi sayımını yapması, aynı kurumun iki farklı yerde
// iki farklı sayı göstermesi demek.
//
// departedWithDebt AYRI tutulur: ödeme panelinde ayrılmış ama borçlu
// öğrenciler bilerek listelenir (bkz. madde 3) ve o ekrandaki toplam
// bu yüzden aktif sayısından fazla çıkar. Sayıyı gizlemek yerine
// FARKI adlandırıyoruz.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const institutionId = session.institutionId;

    const [activeStudents, activeTeachers, branches, departedWithDebt] = await Promise.all([
      prisma.student.count({ where: { institutionId, isActive: true } }),
      prisma.teacher.count({ where: { institutionId, isActive: true } }),
      prisma.branch.count({ where: { institutionId } }),
      prisma.student.count({
        where: {
          institutionId,
          isActive: false,
          installments: { some: { status: { in: ["PENDING", "PARTIALLY_PAID"] } } },
        },
      }),
    ]);

    return NextResponse.json({ activeStudents, activeTeachers, branches, departedWithDebt });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("admin_counts_failed", error);
  }
}

export const GET = withApiLogging("GET /api/admin/counts", handleGet);
