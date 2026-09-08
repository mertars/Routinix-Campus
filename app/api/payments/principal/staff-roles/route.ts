import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { recordPaymentAudit } from "@/lib/server/payments/payment-audit";
import { PAYMENT_ROLE_LABEL, type PaymentRole } from "@/lib/payments/payment-roles";

export const dynamic = "force-dynamic";

const VALID_ROLES: PaymentRole[] = ["NONE", "COLLECTOR", "FULL"];

// GET — kurumdaki yöneticiler ve ödeme yetkileri.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const admins = await prisma.admin.findMany({
      where: { institutionId: session.institutionId },
      select: { id: true, firstName: true, lastName: true, title: true, paymentRole: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return NextResponse.json({
      admins: admins.map((a) => ({
        id: a.id,
        name: `${a.firstName} ${a.lastName}`,
        title: a.title,
        paymentRole: a.paymentRole,
        isSelf: a.id === session.sub,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("staff_roles_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// PATCH — { adminId, paymentRole }
async function handlePatch(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const adminId = body?.adminId as string | undefined;
    const paymentRole = body?.paymentRole as PaymentRole | undefined;

    if (!adminId || !paymentRole || !VALID_ROLES.includes(paymentRole)) {
      return NextResponse.json({ error: "adminId ve geçerli bir paymentRole zorunludur." }, { status: 400 });
    }
    // Kendi yetkisini değiştirmek YASAK: hem kilitlenmeyi hem de "kendi
    // kendine tam yetki verme" yolunu kapatır. Yetkiyi başkası verir.
    if (adminId === session.sub) {
      return NextResponse.json({ error: "Kendi ödeme yetkinizi değiştiremezsiniz." }, { status: 400 });
    }

    const target = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { institutionId: true, firstName: true, lastName: true, paymentRole: true },
    });
    if (!target || target.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Yönetici bulunamadı." }, { status: 404 });
    }
    if (target.paymentRole === paymentRole) return NextResponse.json({ ok: true, unchanged: true });

    // Kilitlenmeye karşı SON SAVUNMA. Normal akışta buraya düşülmez:
    // yetkiyi ancak FULL biri değiştirebilir ve kendini değiştiremez,
    // yani hedef FULL ise ortada zaten en az iki FULL vardır. Kontrol,
    // iki yöneticinin AYNI ANDA birbirini düşürdüğü yarış durumu ve
    // ileride buraya yeni bir çağıran eklenmesi ihtimali için duruyor —
    // tam yetkilinin sıfırlanması geri dönüşü olmayan bir kilitlenmedir.
    if (target.paymentRole === "FULL" && paymentRole !== "FULL") {
      const fullCount = await prisma.admin.count({
        where: { institutionId: session.institutionId, paymentRole: "FULL" },
      });
      if (fullCount <= 1) {
        return NextResponse.json(
          { error: "Kurumda en az bir tam yetkili yönetici kalmalıdır." },
          { status: 400 }
        );
      }
    }

    await prisma.admin.update({ where: { id: adminId }, data: { paymentRole } });

    await recordPaymentAudit({
      session,
      action: "PAYMENT_ROLE_CHANGED",
      targetType: "Admin",
      targetId: adminId,
      amount: 0,
      summary: `${target.firstName} ${target.lastName} · ${PAYMENT_ROLE_LABEL[target.paymentRole as PaymentRole]} → ${PAYMENT_ROLE_LABEL[paymentRole]}`,
      metadata: { previousRole: target.paymentRole, newRole: paymentRole },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("staff_role_update_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/staff-roles", handleGet);
export const PATCH = withApiLogging("PATCH /api/payments/principal/staff-roles", handlePatch);
