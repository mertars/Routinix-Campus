import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { recordPaymentAudit } from "@/lib/server/payments/payment-audit";
import { computeAccountBalances } from "@/lib/server/payments/account-balance";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET — son virman hareketleri.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const transfers = await prisma.accountTransfer.findMany({
      where: { institutionId: session.institutionId },
      include: { fromAccount: { select: { name: true } }, toAccount: { select: { name: true } } },
      orderBy: { transferredAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      transfers: transfers.map((t) => ({
        id: t.id,
        fromName: t.fromAccount.name,
        toName: t.toAccount.name,
        amount: Number(t.amount),
        transferredAt: t.transferredAt.toISOString(),
        note: t.note,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("transfers_list_failed", error);
  }
}

// POST — { fromAccountId, toAccountId, amount, note? }
// Virman gelir/gider DEĞİLDİR (bkz. schema > AccountTransfer gerekçesi):
// toplam bakiyeyi değiştirmez, sadece hesaplar arasında taşır.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const fromAccountId = body?.fromAccountId as string | undefined;
    const toAccountId = body?.toAccountId as string | undefined;
    const amount = Number(body?.amount);
    const note = (body?.note as string | undefined)?.trim() || null;

    if (!fromAccountId || !toAccountId) return NextResponse.json({ error: "fromAccountId ve toAccountId zorunludur." }, { status: 400 });
    if (fromAccountId === toAccountId) return NextResponse.json({ error: "Kaynak ve hedef hesap aynı olamaz." }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount pozitif bir sayı olmalı." }, { status: 400 });

    const accounts = await prisma.paymentAccount.findMany({
      where: { id: { in: [fromAccountId, toAccountId] }, institutionId: session.institutionId },
      select: { id: true },
    });
    if (accounts.length !== 2) return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });

    // Kaynak hesapta yeterli bakiye yoksa engelle — aksi halde kasa eksiye
    // düşer ve tablo gerçeği yansıtmaz.
    const balances = await computeAccountBalances(session.institutionId);
    const source = balances.find((b) => b.id === fromAccountId);
    if (!source || source.balance < amount) {
      return NextResponse.json(
        { error: `Yetersiz bakiye: kaynak hesapta ${(source?.balance ?? 0).toFixed(2)} ₺ var.` },
        { status: 400 }
      );
    }

    const transfer = await prisma.accountTransfer.create({
      data: { institutionId: session.institutionId, fromAccountId, toAccountId, amount, note, recordedByAdminId: session.sub },
    });
    const names = new Map(
      (await prisma.paymentAccount.findMany({
        where: { id: { in: [fromAccountId, toAccountId] } },
        select: { id: true, name: true },
      })).map((a) => [a.id, a.name])
    );
    await recordPaymentAudit({
      session,
      action: "ACCOUNT_TRANSFERRED",
      targetType: "AccountTransfer",
      targetId: transfer.id,
      amount,
      summary: `${names.get(fromAccountId) ?? "?"} → ${names.get(toAccountId) ?? "?"}`,
      metadata: { fromAccountId, toAccountId },
    });

    return NextResponse.json({ transfer: { id: transfer.id } }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("transfer_create_failed", error);
  }
}

export const GET = withApiLogging("GET /api/payments/principal/transfers", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/transfers", handlePost);
