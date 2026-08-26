import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireInstitution, assertOwnsSelf, assertTeacherOwnsStudent, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/preferences?studentId=X — öğrencinin kaydettiği YKS/LGS tercih
// sırası (program.id'leri, UNIVERSITY_PROGRAMS statik referansına karşılık gelir).
// Erişim students/[id] ile aynı sahiplik kuralına tabidir.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId parametresi zorunludur." }, { status: 400 });
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, studentId);
    else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, studentId);
    else if (session.role === "PARENT") await assertParentOwnsStudent(session.sub, studentId);

    const rows = await prisma.studentPreference.findMany({ where: { studentId }, orderBy: { position: "asc" } });
    return NextResponse.json({ programIds: rows.map((r) => r.programId) });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("preferences_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// PUT /api/preferences — { studentId, programIds: string[] } tüm listeyi
// (sırasıyla) yeniden yazar — sürükle-bırak/ekle-çıkar sonrası tek istekte kaydeder.
// SADECE öğrencinin kendisi ya da bir yönetici düzenleyebilir.
async function handlePut(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const { studentId, programIds } = body as { studentId?: string; programIds?: string[] };
    if (!studentId || !Array.isArray(programIds)) {
      return NextResponse.json({ error: "studentId ve programIds (dizi) zorunludur." }, { status: 400 });
    }
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, studentId);
    else if (session.role !== "ADMIN") throw new AuthError("Bu işlem için yetkiniz yok.", "FORBIDDEN_ROLE", 403);

    await prisma.$transaction([
      prisma.studentPreference.deleteMany({ where: { studentId } }),
      prisma.studentPreference.createMany({
        data: programIds.map((programId, index) => ({ studentId, programId, position: index })),
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("preferences_put_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/preferences", handleGet);
export const PUT = withApiLogging("PUT /api/preferences", handlePut);
