import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { recordAuditLog } from "@/lib/server/audit/audit-log";

export const dynamic = "force-dynamic";

// GET — kurumdaki SMS izni durumu.
//
// smsConsent her yerde OKUNUYOR ama kayıt akışının hiçbir yeri onu
// YAZMIYORDU; varsayılanı false olduğu için uygulamadan kaydedilen her
// velinin izni kapalı kalıyor ve "tüm okula SMS" sessizce kimseye
// ulaşmıyordu. Bu uç hem durumu görünür kılar hem de düzeltme yolu verir.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const [total, consenting] = await Promise.all([
      prisma.parent.count({ where: { institutionId: session.institutionId } }),
      prisma.parent.count({ where: { institutionId: session.institutionId, smsConsent: true } }),
    ]);

    return NextResponse.json({ total, consenting, missing: total - consenting });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("sms_consent_status_failed", error);
  }
}

// POST { parentIds?: string[], value: boolean }
//
// parentIds verilmezse KURUMUN TÜM velilerine uygulanır — bu, izni hiç
// sorulmamış eski kayıtları tek seferde düzeltmek içindir.
//
// ⚠️ Bu bir RIZA kaydıdır: kimin ne zaman açtığı denetim kaydına
// yazılır. Toplu açma, müdürün velilerden izni fiilen aldığı
// varsayımına dayanır; arayüz bunu açıkça söyler.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);
    const value = body?.value;
    if (typeof value !== "boolean") {
      return NextResponse.json({ error: "value true veya false olmalı." }, { status: 400 });
    }
    const parentIds = Array.isArray(body?.parentIds) ? (body.parentIds as string[]) : null;

    const result = await prisma.parent.updateMany({
      where: {
        institutionId: session.institutionId,
        ...(parentIds ? { id: { in: parentIds } } : {}),
      },
      data: { smsConsent: value },
    });

    await recordAuditLog({
      institutionId: session.institutionId,
      actorId: session.sub,
      actorRole: "ADMIN",
      action: "USER_UPDATED",
      targetType: "Parent",
      targetId: `${result.count} veli`,
      metadata: { smsConsent: value, scope: parentIds ? "seçili" : "tümü", count: result.count },
    });

    return NextResponse.json({ updated: result.count, value });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("sms_consent_update_failed", error);
  }
}

export const GET = withApiLogging("GET /api/admin/sms/consent", handleGet);
export const POST = withApiLogging("POST /api/admin/sms/consent", handlePost);
