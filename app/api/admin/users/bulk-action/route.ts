import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import {
  runBulkAction,
  previewGradePromotion,
  undoBulkAction,
  BULK_ACTIONS,
  type BulkAction,
} from "@/lib/server/admin/bulk-actions";

export const dynamic = "force-dynamic";

// POST /api/admin/users/bulk-action
//   { action, role, ids, targetBranchId?, branchMap?, renewal? }
//
// Kullanıcı listesinde seçilen kayıtlara toplu işlem uygular. Sonuç
// "hep ya da hiç" DEĞİLDİR: her kaydın kendi sonucu (ve başarısızsa
// sebebi) döner.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    // POST ?undo=<denetim kaydı id> — geri alınabilir bir toplu işlemi
    // geri sarar (bkz. UNDOABLE_ACTIONS ve UNDO_WINDOW_MINUTES).
    // Gövde okunmadan ÖNCE bakılır: geri alma isteği gövde taşımaz.
    const undoId = request.nextUrl.searchParams.get("undo");
    if (undoId) {
      const undone = await undoBulkAction(session.institutionId, undoId);
      return NextResponse.json(undone);
    }

    const body = await request.json().catch(() => null);
    const action = body?.action as BulkAction | undefined;
    const role = body?.role as "STUDENT" | "TEACHER" | undefined;
    const ids = body?.ids as string[] | undefined;

    if (!action || !BULK_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `İşlem geçersiz. Geçerli değerler: ${BULK_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }
    if (role !== "STUDENT" && role !== "TEACHER") {
      return NextResponse.json({ error: "role 'STUDENT' veya 'TEACHER' olmalı." }, { status: 400 });
    }

    const renewalBody = body?.renewal as
      | { startDate?: string; endDate?: string; listAmount?: number | null; installmentCount?: number | null }
      | undefined;

    // Toplu yenilemede ücret girilirse BORÇ YAZILIYOR demektir; tek tek
    // yenilemede olduğu gibi (bkz. enrollments/[id]/renew) ödeme
    // modülünde tam yetki ister — toplu ekran arka kapı olamaz.
    if (action === "RENEW_ENROLLMENT" && renewalBody?.listAmount != null) {
      await requirePaymentRole(session, "FULL");
    }

    const startDate = renewalBody?.startDate ? new Date(renewalBody.startDate) : undefined;
    if (action === "RENEW_ENROLLMENT" && (!startDate || Number.isNaN(startDate.getTime()))) {
      return NextResponse.json({ error: "Yeni dönem başlangıcı geçerli bir tarih olmalı." }, { status: 400 });
    }

    const result = await runBulkAction({
      action,
      role,
      ids: ids ?? [],
      institutionId: session.institutionId,
      actorId: session.sub,
      targetBranchId: body?.targetBranchId as string | undefined,
      branchMap: body?.branchMap as Record<string, string> | undefined,
      renewal: startDate
        ? {
            startDate,
            endDate: renewalBody?.endDate ? new Date(renewalBody.endDate) : undefined,
            listAmount: renewalBody?.listAmount ?? null,
            installmentCount: renewalBody?.installmentCount ?? null,
          }
        : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    return apiFailure("bulk_action_failed", error);
  }
}

// GET ?ids=a,b,c — sınıf atlatma ÖNİZLEMESİ.
//
// Hangi şubenin hangi şubeye gideceğini tahmin edip müdüre gösterir.
// Uygulama ayrı bir POST ile, onaylanan eşlemeyle yapılır.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ error: "En az bir öğrenci seçin." }, { status: 400 });

    const pairs = await previewGradePromotion(session.institutionId, ids);
    return NextResponse.json({ pairs });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("bulk_promotion_preview_failed", error);
  }
}

export const POST = withApiLogging("POST /api/admin/users/bulk-action", handlePost);
export const GET = withApiLogging("GET /api/admin/users/bulk-action", handleGet);
