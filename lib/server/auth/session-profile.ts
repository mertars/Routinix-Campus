import { prisma } from "@/lib/server/prisma";
import { ROLE_ID_BY_AUTH_ROLE, type RoleId } from "./jwt";
import { requireSession } from "./session-guard";

// ----------------------------------------------------------------------------
// Oturum sahibinin KİMLİK KARTI — isim, unvan, kurum adı, kurum logosu.
//
// ⚠️ NEDEN AYRI BİR DOSYA (2026-09-15, Mert'in bildirdiği hata): bu bilgi
// eskiden SADECE GET /api/auth/session ile, panel mount olduktan SONRA
// alınıyordu. O 2-3 saniye boyunca ekranda lib/mock-data.ts'teki DEMO
// isimleri duruyordu — öğretmen kendi adı yerine "İrfan Hoca", öğrenci
// "Arslan", her panelin üst barı da kurum adı yerine "Arslan Dershaneleri"
// görüyordu. Yani her kullanıcı, her açılışta, BAŞKA BİRİNİN adını görüyordu.
//
// Artık aynı mantık hem o API rotasından hem de KÖK LAYOUT'tan (sunucuda,
// ilk HTML üretilirken) çağrılır — doğru isim ilk boyamada yerindedir,
// yanlış bir ismin görünebileceği bir an YOKTUR.
// ----------------------------------------------------------------------------

export type SessionProfile = {
  id: string;
  role: RoleId;
  name: string;
  title: string | null;
  institutionName: string | null;
  institutionLogoUrl: string | null;
};

export async function getSessionProfile(): Promise<SessionProfile | null> {
  try {
    const session = await requireSession();
    const [institution, admin] = await Promise.all([
      prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } }),
      // title sadece Admin modelinde var — diğer roller için görmezden gelinir.
      session.role === "ADMIN" ? prisma.admin.findUnique({ where: { id: session.sub }, select: { title: true } }) : null,
    ]);
    return {
      id: session.sub,
      role: ROLE_ID_BY_AUTH_ROLE[session.role],
      name: session.name,
      title: admin?.title ?? null,
      institutionName: institution?.name ?? null,
      institutionLogoUrl: institution?.logoUrl ?? null,
    };
  } catch {
    // Oturum yok/geçersiz (örn. /login, /platform) — çağıran taraf null'ı
    // "henüz kimlik yok" olarak ele alır, hata fırlatmaz.
    return null;
  }
}
