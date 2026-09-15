import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSession, requirePlatformInstitution } from "@/lib/server/auth/platform-session-guard";
import { listPreviewTargets } from "@/lib/server/platform/preview-targets";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import type { RoleId } from "@/lib/server/auth/jwt";

export const dynamic = "force-dynamic";

const VALID_ROLES = new Set<RoleId>(["principal", "teacher", "student", "parent", "guidance"]);

// GET /api/platform/preview/users?institutionId=&role= — o kurumda o rolle
// önizlenebilecek GERÇEK hesaplar (bkz. app/api/platform/preview/route.ts'teki
// güvenlik notu). Telefon numarası da dönüyor ama hiçbir şifre/hash DÖNMEZ.
async function handleGet(request: NextRequest) {
  try {
    await requirePlatformSession();
    const institutionId = request.nextUrl.searchParams.get("institutionId") ?? "";
    const role = (request.nextUrl.searchParams.get("role") ?? "") as RoleId;
    if (!institutionId || !VALID_ROLES.has(role)) {
      throw new AuthError("Kurum ve rol zorunludur.", "MISSING_FIELDS", 400);
    }
    await requirePlatformInstitution(institutionId);
    const users = await listPreviewTargets(institutionId, role);
    return NextResponse.json({ users: users.map((u) => ({ id: u.id, name: u.name, detail: u.detail })) });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("platform_preview_users_failed", error);
  }
}

export const GET = withApiLogging("GET /api/platform/preview/users", handleGet);
