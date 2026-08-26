import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { ROLE_ID_BY_AUTH_ROLE } from "@/lib/server/auth/jwt";
import { requireSession } from "@/lib/server/auth/session-guard";
import { authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";

// GET /api/auth/session — oturum açmış kullanıcının KENDİ kimliğini
// (id/rol/isim) döner. httpOnly cookie istemci JS'inden okunamadığı için,
// öğrenci/öğretmen panellerinin "bu benim kendi id'm" bilgisini öğrenmesinin
// TEK yolu budur (bkz. lib/student-scope.ts, lib/teacher-scope.ts — artık
// sabit demo id yerine buradan gelen gerçek session.sub'ı kullanır).
// institutionName burada da döner — TÜM panellerin üst barları ve yazdırma
// önizlemeleri artık bunu okur (bkz. lib/institution-scope.ts), eskiden
// hepsi lib/mock-data.ts'teki sabit "Arslan Dershaneleri" ismini
// gösteriyordu — yeni bir kurum için bu tamamen yanlış olurdu.
async function handleGet() {
  try {
    const session = await requireSession();
    const [institution, admin] = await Promise.all([
      prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true } }),
      // title sadece Admin modelinde var (bkz. app/principal/page.tsx > Hero) —
      // diğer roller için görmezden gelinir, client tarafı zaten sadece
      // ADMIN oturumunda bu alanı okur.
      session.role === "ADMIN" ? prisma.admin.findUnique({ where: { id: session.sub }, select: { title: true } }) : null,
    ]);
    return NextResponse.json({
      id: session.sub,
      role: ROLE_ID_BY_AUTH_ROLE[session.role],
      name: session.name,
      title: admin?.title ?? null,
      institutionName: institution?.name ?? null,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export const GET = withApiLogging("GET /api/auth/session", handleGet);
