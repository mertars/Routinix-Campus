import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { runScheduleImport, SCHEDULE_DAYS, type RawScheduleRow } from "@/lib/server/schedule/bulk-schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ROWS = 1000;

// POST /api/lesson-slots/bulk — { rows, dryRun }
//
// Ders programını toplu kurar. Eskiden tek yol sürükle-bırak'tı: 12
// şube × 10 saat = 120 ayrı sürükleme.
//
// İKİ AŞAMALI: müdür önce dryRun ile dosyayı KONTROL EDER (hangi satır
// neden geçmiyor, hangisi mevcut dersin üzerine yazacak), sonra uygular.
// Tek adımlı olsaydı 120 satırlık bir dosyanın 3 hatalı satırı ancak
// uygulandıktan sonra fark edilirdi.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);
    const rows = body?.rows as RawScheduleRow[] | undefined;
    const dryRun = body?.dryRun !== false;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "rows zorunludur ve boş olamaz." }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Tek seferde en fazla ${MAX_ROWS} satır aktarılabilir.` }, { status: 400 });
    }

    const outcome = await runScheduleImport(rows, session.institutionId, { dryRun });
    logger.info("schedule_bulk_import", {
      institutionId: session.institutionId,
      dryRun,
      total: rows.length,
      ok: outcome.okCount,
      failed: outcome.failedCount,
    });

    return NextResponse.json({ ...outcome, dryRun, days: SCHEDULE_DAYS });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("schedule_bulk_import_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/lesson-slots/bulk", handlePost);
