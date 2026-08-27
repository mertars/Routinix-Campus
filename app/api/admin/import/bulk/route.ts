import { NextRequest, NextResponse } from "next/server";
import { runBulkImport, type RawRow, type BulkImportRole } from "@/lib/server/admin/bulk-import";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/admin/import/bulk — { role: "STUDENT"|"TEACHER"|"BRANCH", rows: [...] }
// İstemci dry-run önizlemesi sadece kullanıcıya erken geri bildirim içindir;
// güvenlik/doğruluk için TÜM satırlar sunucuda (bkz. lib/server/admin/bulk-import.ts)
// YENİDEN doğrulanır. Bu, kurum yöneticisinin KENDİ kurumuna içe aktarma
// yaptığı yol — platform sahibinin (herhangi bir kurum için) aynı işi yaptığı
// eşdeğeri app/api/platform/institutions/[id]/import/bulk/route.ts'tedir,
// ikisi de AYNI runBulkImport() fonksiyonunu çağırır.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { role, rows } = body as { role?: BulkImportRole; rows?: RawRow[] };

    if (role !== "STUDENT" && role !== "TEACHER" && role !== "BRANCH") {
      return NextResponse.json({ error: "role 'STUDENT', 'TEACHER' veya 'BRANCH' olmalı." }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "rows (dizi) zorunludur ve boş olamaz." }, { status: 400 });
    }
    if (rows.length > 500) {
      return NextResponse.json({ error: "Tek seferde en fazla 500 satır işlenebilir." }, { status: 400 });
    }

    const outcome = await runBulkImport(role, rows, session.institutionId, session.sub);
    logger.info("admin_bulk_import_completed", { role, total: rows.length, ...outcome, results: undefined });
    return NextResponse.json(outcome);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_bulk_import_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/import/bulk", handlePost);
