import { NextRequest, NextResponse } from "next/server";
import { runBulkImport, type RawRow, type BulkImportRole } from "@/lib/server/admin/bulk-import";
import { requirePlatformSession, requirePlatformInstitution } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// app/api/admin/import/bulk/route.ts'in platform-sahibi eşdeğeri — kurum
// yöneticisine giriş yapmadan, seçilen KURUM için Excel/CSV toplu içe
// aktarma yapar (Şube/Öğrenci/Öğretmen). AYNI runBulkImport() fonksiyonunu
// çağırır — bu, platform sahibinin yeni bir dershaneye ilk kurulumu (tüm
// şubeler + öğrenciler + öğretmenler) kendi panelinden tek seferde
// yükleyebilmesinin asıl uç noktasıdır.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePlatformSession();
    await requirePlatformInstitution(params.id);

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

    const outcome = await runBulkImport(role, rows, params.id, session.sub);
    logger.info("platform_bulk_import_completed", { role, total: rows.length, successCount: outcome.successCount, failedCount: outcome.failedCount });
    return NextResponse.json(outcome);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("platform_bulk_import_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/platform/institutions/[id]/import/bulk", handlePost);
