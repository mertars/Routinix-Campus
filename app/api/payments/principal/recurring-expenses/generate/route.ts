import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { monthKey } from "@/lib/server/payments/cashflow";

export const dynamic = "force-dynamic";

// POST — bu ayın tekrar eden giderlerini TASLAK (PENDING) olarak üretir.
//
// ÖDEMEZ, yalnızca hazırlar. Sebep: fatura tutarı her ay değişir ve para
// çıkışı müdürün onayıyla olmalıdır. Müdür tutarı düzeltip "Öde" der;
// böylece hem yazma zahmeti biter hem kontrol kaybolmaz.
//
// Mükerrer üretim lastGeneratedMonth ile engellenir — iki kez basılırsa
// aynı kira iki kez gider yazılır ve bakiye sessizce bozulurdu.
async function handlePost(_request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const now = new Date();
    const current = monthKey(now);

    // ⚠️ `NOT: { lastGeneratedMonth: current }` YAZILAMAZ: SQL'e
    // `NOT (col = '2026-09')` olarak çevrilir ve col NULL iken sonuç NULL
    // (yani FALSE sayılır) — HİÇ üretilmemiş şablonlar elenir, özellik
    // sessizce hiç çalışmaz. NULL durumu açıkça yazılmalı.
    const rules = await prisma.recurringExpense.findMany({
      where: {
        institutionId: session.institutionId,
        isActive: true,
        OR: [{ lastGeneratedMonth: null }, { lastGeneratedMonth: { not: current } }],
      },
    });
    if (rules.length === 0) {
      return NextResponse.json({ created: 0, message: "Bu ay için hazırlanacak tekrar eden gider yok." });
    }

    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const rule of rules) {
        const dueDate = new Date(now.getFullYear(), now.getMonth(), rule.dayOfMonth);
        const expense = await tx.expense.create({
          data: {
            institutionId: session.institutionId,
            categoryId: rule.categoryId,
            title: `${rule.title} — ${dueDate.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}`,
            vendorName: rule.vendorName,
            amount: rule.amount,
            dueDate,
            status: "PENDING",
            note: "Tekrar eden gider şablonundan hazırlandı.",
            recordedByAdminId: session.sub,
          },
        });
        await tx.recurringExpense.update({ where: { id: rule.id }, data: { lastGeneratedMonth: current } });
        rows.push({ id: expense.id, title: expense.title, amount: Number(expense.amount) });
      }
      return rows;
    });

    return NextResponse.json({ created: created.length, expenses: created, month: current }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("recurring_expense_generate_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/payments/principal/recurring-expenses/generate", handlePost);
