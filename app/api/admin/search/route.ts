import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { globalSearch } from "@/lib/server/admin/global-search";

export const dynamic = "force-dynamic";

// GET ?q=... — kurum genelinde öğrenci / öğretmen / veli araması.
//
// Sonuçlar HER ZAMAN oturumun kurumuyla sınırlıdır; sorgu metni
// doğrudan bir filtre olarak kullanılmaz, Prisma parametreleştirir.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const q = request.nextUrl.searchParams.get("q") ?? "";
    if (q.trim().length < 2) {
      return NextResponse.json({ hits: [], hint: "En az 2 karakter yazın." });
    }

    const hits = await globalSearch(session.institutionId, q);
    return NextResponse.json({ hits });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("global_search_failed", error);
  }
}

export const GET = withApiLogging("GET /api/admin/search", handleGet);
