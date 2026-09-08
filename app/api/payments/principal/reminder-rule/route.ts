import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import {
  DEFAULT_BEFORE_TEMPLATE,
  DEFAULT_AFTER_TEMPLATE,
  REMINDER_REPEAT_DAYS,
  collectDueSoon,
  collectOverdue,
} from "@/lib/server/payments/reminder-service";

export const dynamic = "force-dynamic";

const MAX_DAYS = 30;

// GET — otomatik hatırlatma kuralı + bugün kaç kişiye gideceğinin ÖNİZLEMESİ.
//
// Önizleme olmadan müdür "aç" düğmesine basarken kaç veliye SMS gideceğini
// bilemez; kontör yakan bir işlemde bu kabul edilemez.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    // Kayıt yoksa oluşturmadan varsayılanı döndür — sadece görüntülemek
    // için satır yazmak, hiç kullanmayacak kurumlarda çöp bırakırdı.
    const rule = await prisma.reminderRule.findUnique({ where: { institutionId: session.institutionId } });
    const daysBefore = rule?.daysBefore ?? 3;
    const daysAfter = rule?.daysAfter ?? 3;

    const [dueSoon, overdue, institution] = await Promise.all([
      collectDueSoon(session.institutionId, daysBefore),
      collectOverdue(session.institutionId, daysAfter),
      prisma.institution.findUnique({ where: { id: session.institutionId }, select: { smsCredits: true } }),
    ]);

    return NextResponse.json({
      rule: {
        isActive: rule?.isActive ?? false,
        daysBefore,
        beforeTemplate: rule?.beforeTemplate ?? DEFAULT_BEFORE_TEMPLATE,
        daysAfter,
        afterTemplate: rule?.afterTemplate ?? DEFAULT_AFTER_TEMPLATE,
        lastRunAt: rule?.lastRunAt?.toISOString() ?? null,
        lastSentCount: rule?.lastSentCount ?? 0,
      },
      preview: { dueSoonCount: dueSoon.length, overdueCount: overdue.length },
      smsCredits: institution?.smsCredits ?? 0,
      repeatDays: REMINDER_REPEAT_DAYS,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("reminder_rule_get_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// PUT — { isActive, daysBefore, beforeTemplate, daysAfter, afterTemplate }
async function handlePut(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const isActive = body?.isActive === true;
    const daysBefore = Number(body?.daysBefore);
    const daysAfter = Number(body?.daysAfter);
    const beforeTemplate = (body?.beforeTemplate as string | undefined)?.trim();
    const afterTemplate = (body?.afterTemplate as string | undefined)?.trim();

    for (const [label, value] of [["daysBefore", daysBefore], ["daysAfter", daysAfter]] as const) {
      if (!Number.isInteger(value) || value < 0 || value > MAX_DAYS) {
        return NextResponse.json({ error: `${label} 0 ile ${MAX_DAYS} arasında bir tam sayı olmalı.` }, { status: 400 });
      }
    }
    if (!beforeTemplate || !afterTemplate) {
      return NextResponse.json({ error: "Her iki mesaj şablonu da dolu olmalı." }, { status: 400 });
    }
    // İkisi de 0 iken "aktif" olmak anlamsız — kural açık görünür ama
    // hiçbir şey göndermez, müdür gönderildiğini sanır.
    if (isActive && daysBefore === 0 && daysAfter === 0) {
      return NextResponse.json(
        { error: "Kural aktifken en az bir hatırlatma türü (öncesi veya sonrası) açık olmalıdır." },
        { status: 400 }
      );
    }

    const data = { isActive, daysBefore, daysAfter, beforeTemplate, afterTemplate };
    await prisma.reminderRule.upsert({
      where: { institutionId: session.institutionId },
      update: data,
      create: { institutionId: session.institutionId, ...data },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("reminder_rule_put_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/reminder-rule", handleGet);
export const PUT = withApiLogging("PUT /api/payments/principal/reminder-rule", handlePut);
