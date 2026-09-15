import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/server/auth/session-profile";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";

// GET /api/auth/session — oturum açmış kullanıcının KENDİ kimliğini
// (id/rol/isim/kurum) döner. httpOnly cookie istemci JS'inden okunamadığı
// için, öğrenci/öğretmen panellerinin "bu benim kendi id'm" bilgisini
// öğrenmesinin TEK yolu budur (bkz. lib/student-scope.ts, lib/teacher-scope.ts).
//
// ⚠️ Mantık lib/server/auth/session-profile.ts'te; kök layout da AYNI
// fonksiyonu sunucuda çağırıp kimliği ilk HTML'e gömüyor (bkz. oradaki not:
// eskiden bu uç dönene kadar ekranda demo isimler duruyordu). İkisi tek
// kaynaktan beslenmezse panelin gördüğü kimlik ayrışır.
async function handleGet() {
  try {
    const profile = await getSessionProfile();
    if (!profile) throw new AuthError("Oturum bulunamadı. Lütfen giriş yapın.", "NO_SESSION", 401);
    return NextResponse.json(profile);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export const GET = withApiLogging("GET /api/auth/session", handleGet);
