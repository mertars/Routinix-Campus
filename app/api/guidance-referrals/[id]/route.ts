import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { recordAuditLog } from "@/lib/server/audit/audit-log";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// PATCH /api/guidance-referrals/[id] — { status: "REVIEWED" }. Sevk
// Kuyruğu'ndaki (bkz. ../route.ts > handleGet) "Görüldü İşaretle" tuşunun
// hedefi — GuidanceReferralStatus zaten PENDING/REVIEWED taşıyor, şema
// değişikliği yok.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal", "guidance");

    const body = await request.json().catch(() => null);
    const status = body?.status;
    if (status !== "REVIEWED" && status !== "PENDING") {
      return NextResponse.json({ error: "status PENDING veya REVIEWED olmalıdır." }, { status: 400 });
    }

    const referral = await prisma.guidanceReferral.findUnique({
      where: { id: params.id },
      select: { id: true, student: { select: { institutionId: true } } },
    });
    if (!referral) return NextResponse.json({ error: "Sevk kaydı bulunamadı." }, { status: 404 });
    requireInstitution(session, referral.student.institutionId);

    const updated = await prisma.guidanceReferral.update({ where: { id: params.id }, data: { status } });

    await recordAuditLog({
      institutionId: referral.student.institutionId,
      actorId: session.sub,
      actorRole: session.role,
      action: "GUIDANCE_REFERRAL_STATUS_CHANGED",
      targetType: "GuidanceReferral",
      targetId: params.id,
      metadata: { status },
    });

    return NextResponse.json({ guidanceReferral: updated });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_referral_update_failed", error);
  }
}

export const PATCH = withApiLogging("PATCH /api/guidance-referrals/[id]", handlePatch);
