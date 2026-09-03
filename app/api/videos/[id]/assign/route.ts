import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/videos/[id]/assign — { studentIds: string[] }. Hedef seçimi
// (tekil öğrenci / şube / sınıf seviyesi) İSTEMCİ tarafında (bkz.
// video-assign-modal.tsx) zaten elindeki roster'dan somut bir studentId
// listesine çözülüyor — Xray'deki AssignmentTarget gibi ayrı bir
// "hedef tipi" sunucuya taşınmıyor, burası sade tutuldu.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const video = await prisma.video.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!video) return NextResponse.json({ error: "Video bulunamadı." }, { status: 404 });
    requireInstitution(session, video.institutionId);

    const body = await request.json().catch(() => null);
    const studentIds = Array.isArray(body?.studentIds) ? body.studentIds.filter((id: unknown) => typeof id === "string") : [];
    if (studentIds.length === 0) return NextResponse.json({ error: "studentIds zorunludur." }, { status: 400 });

    const validStudents = await prisma.student.findMany({ where: { id: { in: studentIds }, institutionId: session.institutionId }, select: { id: true } });
    if (validStudents.length === 0) return NextResponse.json({ error: "Geçerli öğrenci bulunamadı." }, { status: 400 });

    // skipDuplicates — aynı videonun aynı öğrenciye TEKRAR atanması
    // (ör. yönetici bir önceki atamayı unutup ikinci kez atarsa) hata
    // FIRLATMAZ, sessizce atlanır (bkz. @@unique([videoId, studentId])).
    const result = await prisma.videoAssignment.createMany({
      data: validStudents.map((s) => ({ videoId: params.id, studentId: s.id })),
      skipDuplicates: true,
    });

    return NextResponse.json({ assignedCount: result.count });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_assign_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Atama yapılamadı." }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/videos/[id]/assign", handlePost);
