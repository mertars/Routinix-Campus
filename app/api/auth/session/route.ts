import { NextResponse } from "next/server";
import { ROLE_ID_BY_AUTH_ROLE } from "@/lib/server/auth/jwt";
import { requireSession } from "@/lib/server/auth/session-guard";
import { authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";

// GET /api/auth/session — oturum açmış kullanıcının KENDİ kimliğini
// (id/rol/isim) döner. httpOnly cookie istemci JS'inden okunamadığı için,
// öğrenci/öğretmen panellerinin "bu benim kendi id'm" bilgisini öğrenmesinin
// TEK yolu budur (bkz. lib/student-scope.ts, lib/teacher-scope.ts — artık
// sabit demo id yerine buradan gelen gerçek session.sub'ı kullanır).
async function handleGet() {
  try {
    const session = await requireSession();
    return NextResponse.json({
      id: session.sub,
      role: ROLE_ID_BY_AUTH_ROLE[session.role],
      name: session.name,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export const GET = withApiLogging("GET /api/auth/session", handleGet);
