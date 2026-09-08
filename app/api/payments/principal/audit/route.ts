import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { PAYMENT_AUDIT_LABEL, type PaymentAuditAction } from "@/lib/payments/audit-actions";

export const dynamic = "force-dynamic";

const PAYMENT_ACTIONS = Object.keys(PAYMENT_AUDIT_LABEL) as PaymentAuditAction[];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// GET /api/payments/principal/audit?action=&actorId=&days=&limit=
//
// Finansal denetim izi. AuditLog kurum genelinde tutulur (not girişi,
// kullanıcı oluşturma vb. de orada); bu uç YALNIZCA ödeme modülünün
// eylemlerini süzer — müdür "para kim ne yaptı" sorusunu sorarken
// rehberlik notlarını görmemeli.
//
// Aktör adları TEK seferde toplu çekilir: AuditLog.actorId'nin FK'si
// yoktur (polimorfik), bu yüzden join yapılamaz.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const params = request.nextUrl.searchParams;
    const actionFilter = params.get("action") as PaymentAuditAction | null;
    const actorId = params.get("actorId");
    const days = Number(params.get("days"));
    const requestedLimit = Number(params.get("limit"));
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(MAX_LIMIT, Math.floor(requestedLimit)) : DEFAULT_LIMIT;

    const since = Number.isFinite(days) && days > 0 ? new Date(Date.now() - days * 86_400_000) : null;

    const logs = await prisma.auditLog.findMany({
      where: {
        institutionId: session.institutionId,
        action: actionFilter && PAYMENT_ACTIONS.includes(actionFilter) ? actionFilter : { in: PAYMENT_ACTIONS },
        ...(actorId ? { actorId } : {}),
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const actorIds = [...new Set(logs.map((l) => l.actorId))];
    const admins = await prisma.admin.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const actorName = new Map(admins.map((a) => [a.id, `${a.firstName} ${a.lastName}`]));

    // Filtre açılırı için: bu kurumda ödeme işlemi yapmış kişiler.
    const distinctActors = await prisma.auditLog.findMany({
      where: { institutionId: session.institutionId, action: { in: PAYMENT_ACTIONS } },
      select: { actorId: true },
      distinct: ["actorId"],
    });
    const allActorIds = distinctActors.map((a) => a.actorId);
    const allAdmins = await prisma.admin.findMany({
      where: { id: { in: allActorIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    return NextResponse.json({
      entries: logs.map((l) => {
        const meta = (l.metadata ?? {}) as Record<string, unknown>;
        return {
          id: l.id,
          action: l.action,
          actionLabel: PAYMENT_AUDIT_LABEL[l.action as PaymentAuditAction] ?? l.action,
          // Aktör silinmişse id yerine açık bir metin — boş hücre, kaydın
          // bozuk olduğu izlenimi verirdi.
          actorName: actorName.get(l.actorId) ?? "Silinmiş kullanıcı",
          amount: typeof meta.amount === "number" ? meta.amount : 0,
          summary: typeof meta.summary === "string" ? meta.summary : "",
          targetType: l.targetType,
          targetId: l.targetId,
          createdAt: l.createdAt.toISOString(),
        };
      }),
      actors: allAdmins.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` })),
      actions: PAYMENT_ACTIONS.map((a) => ({ value: a, label: PAYMENT_AUDIT_LABEL[a] })),
      limit,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("payment_audit_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/audit", handleGet);
