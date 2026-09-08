import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { recordPaymentAudit } from "@/lib/server/payments/payment-audit";
import { computeAccountBalances } from "@/lib/server/payments/account-balance";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 30;

// GET — nakit hesapların ANLIK sistem bakiyesi + son sayımlar.
//
// Sayım yalnızca NAKİT kasalar için anlamlıdır: banka hesabında sayılacak
// fiziksel para yoktur, mutabakat ekstreyle yapılır.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const [balances, counts] = await Promise.all([
      computeAccountBalances(session.institutionId),
      prisma.cashCount.findMany({
        where: { institutionId: session.institutionId },
        orderBy: { countedAt: "desc" },
        take: HISTORY_LIMIT,
        include: {
          account: { select: { name: true } },
          createdByAdmin: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const cashAccounts = balances.filter((b) => b.type === "CASH");
    const lastByAccount = new Map<string, Date>();
    for (const c of counts) if (!lastByAccount.has(c.accountId)) lastByAccount.set(c.accountId, c.countedAt);

    return NextResponse.json({
      accounts: cashAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        systemBalance: Math.round(a.balance * 100) / 100,
        lastCountedAt: lastByAccount.get(a.id)?.toISOString() ?? null,
      })),
      counts: counts.map((c) => ({
        id: c.id,
        accountName: c.account.name,
        countedAt: c.countedAt.toISOString(),
        systemBalance: Number(c.systemBalance),
        countedAmount: Number(c.countedAmount),
        difference: Number(c.difference),
        note: c.note,
        countedBy: `${c.createdByAdmin.firstName} ${c.createdByAdmin.lastName}`,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("cash_counts_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST — { accountId, countedAmount, note? }
//
// ⚠️ Sayım BAKİYEYİ DÜZELTMEZ. Fark bir OLGU olarak kaydedilir; sistemi
// sessizce sayıma eşitlemek eksik/fazla parayı görünmez kılardı. Gerçek
// düzeltme, gerçek bir gelir/gider kaydıyla yapılır — ve o kayıt da
// denetim izine düşer.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const accountId = body?.accountId as string | undefined;
    const countedAmount = Number(body?.countedAmount);
    const note = (body?.note as string | undefined)?.trim() || null;

    if (!accountId) return NextResponse.json({ error: "accountId zorunludur." }, { status: 400 });
    if (!Number.isFinite(countedAmount) || countedAmount < 0) {
      return NextResponse.json({ error: "Sayılan tutar negatif olamaz." }, { status: 400 });
    }

    const account = await prisma.paymentAccount.findUnique({
      where: { id: accountId },
      select: { institutionId: true, type: true, name: true },
    });
    if (!account || account.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });
    }
    if (account.type !== "CASH") {
      return NextResponse.json({ error: "Gün sonu sayımı yalnızca nakit kasalar için yapılır." }, { status: 400 });
    }

    // Sistem bakiyesi sayım ANINDA hesaplanıp KAYDEDİLİR — sonradan
    // yeniden hesaplanamaz, çünkü aradan geçen işlemler onu değiştirir.
    const balances = await computeAccountBalances(session.institutionId);
    const systemBalance = Math.round((balances.find((b) => b.id === accountId)?.balance ?? 0) * 100) / 100;
    const difference = Math.round((countedAmount - systemBalance) * 100) / 100;

    const count = await prisma.cashCount.create({
      data: {
        institutionId: session.institutionId,
        accountId,
        systemBalance,
        countedAmount,
        difference,
        note,
        createdByAdminId: session.sub,
      },
    });

    await recordPaymentAudit({
      session,
      action: "CASH_COUNTED",
      targetType: "CashCount",
      targetId: count.id,
      // İzdeki tutar FARK'tır: sayımın haber değeri budur, sayılan
      // toplam değil.
      amount: Math.abs(difference),
      summary:
        difference === 0
          ? `${account.name} · sayım tuttu`
          : `${account.name} · ${difference > 0 ? "fazla" : "eksik"} ${Math.abs(difference).toFixed(2)} ₺`,
      metadata: { accountId, systemBalance, countedAmount, difference },
    });

    return NextResponse.json({ id: count.id, systemBalance, countedAmount, difference }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("cash_count_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/cash-counts", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/cash-counts", handlePost);
