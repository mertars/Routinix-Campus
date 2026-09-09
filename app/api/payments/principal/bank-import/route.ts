import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { importBankStatement, listUnmatched, confirmMatches, ignoreTransaction } from "@/lib/server/payments/bank-import";

export const dynamic = "force-dynamic";

// Tek istekte işlenecek en fazla eşleşme. Ekstre yüzlerce satır
// olabilir ama onay insan eliyle yapılır; üst sınır, tarayıcının tek
// seferde çok iş göndermesini engeller (bkz. toplu işlemlerdeki aynı
// kural).
const MAX_CONFIRM = 100;

// GET — eşleşmemiş ekstre satırları ve her biri için aday öğrenciler.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "COLLECTOR");

    const payload = await listUnmatched(session.institutionId);
    return NextResponse.json({ ...payload, count: payload.rows.length });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("bank_import_list_failed", error);
  }
}

// POST { accountId, rawText } — ekstre içe aktar (henüz tahsilat YAZMAZ).
// POST ?confirm=1 { matches: [{transactionId, studentId, installmentId}] }
// POST ?ignore=<id> { reason }
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);

    // Onay PARA YAZAR — tam yetki ister. İçe aktarma ve listeleme
    // tahsildar yetkisiyle yapılabilir (para hareketi değil, hazırlık).
    if (request.nextUrl.searchParams.get("confirm") === "1") {
      await requirePaymentRole(session, "FULL");
      const matches = Array.isArray(body?.matches) ? body.matches : [];
      if (matches.length === 0) {
        return NextResponse.json({ error: "En az bir eşleşme gönderin." }, { status: 400 });
      }
      if (matches.length > MAX_CONFIRM) {
        return NextResponse.json({ error: `Tek seferde en fazla ${MAX_CONFIRM} satır onaylanabilir.` }, { status: 400 });
      }
      const results = await confirmMatches({
        institutionId: session.institutionId,
        actorId: session.sub,
        matches,
      });
      const ok = results.filter((r) => r.ok).length;
      return NextResponse.json({ results, succeeded: ok, failed: results.length - ok });
    }

    const ignoreId = request.nextUrl.searchParams.get("ignore");
    if (ignoreId) {
      await requirePaymentRole(session, "FULL");
      await ignoreTransaction(session.institutionId, ignoreId, String(body?.reason ?? ""));
      return NextResponse.json({ ok: true });
    }

    await requirePaymentRole(session, "COLLECTOR");
    const accountId = typeof body?.accountId === "string" ? body.accountId : "";
    const rawText = typeof body?.rawText === "string" ? body.rawText : "";
    if (!accountId || !rawText.trim()) {
      return NextResponse.json({ error: "accountId ve rawText zorunludur." }, { status: 400 });
    }

    const summary = await importBankStatement({
      institutionId: session.institutionId,
      accountId,
      rawText,
      importedById: session.sub,
    });
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    return apiFailure("bank_import_failed", error);
  }
}

export const GET = withApiLogging("GET /api/payments/principal/bank-import", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/bank-import", handlePost);
