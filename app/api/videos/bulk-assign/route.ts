import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/videos/bulk-assign — { videoIds: string[], studentIds: string[] }
// Kullanıcı talebi (2026-09-05): Ders > Konu > Videolar hiyerarşisi
// geldikten sonra bir konuda çok video birikince, her birini TEK TEK
// atamak zahmetli hale geldi — bu uç bir konudaki (ya da herhangi bir
// video listesindeki) TÜM videoları seçilen öğrencilere TEK istekte
// atar. /api/videos/[id]/assign'ın AYNI institutionId-doğrulama ilkesi,
// sadece çapraz çarpım (video × öğrenci) halinde.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);
    const videoIds = Array.isArray(body?.videoIds) ? body.videoIds.filter((id: unknown) => typeof id === "string") : [];
    const studentIds = Array.isArray(body?.studentIds) ? body.studentIds.filter((id: unknown) => typeof id === "string") : [];
    if (videoIds.length === 0 || studentIds.length === 0) {
      return NextResponse.json({ error: "videoIds ve studentIds zorunludur." }, { status: 400 });
    }

    const [validVideos, validStudents] = await Promise.all([
      prisma.video.findMany({ where: { id: { in: videoIds }, institutionId: session.institutionId }, select: { id: true } }),
      prisma.student.findMany({ where: { id: { in: studentIds }, institutionId: session.institutionId }, select: { id: true } }),
    ]);
    if (validVideos.length === 0 || validStudents.length === 0) {
      return NextResponse.json({ error: "Geçerli video veya öğrenci bulunamadı." }, { status: 400 });
    }

    const data = validVideos.flatMap((v) => validStudents.map((s) => ({ videoId: v.id, studentId: s.id })));
    const result = await prisma.videoAssignment.createMany({ data, skipDuplicates: true });

    return NextResponse.json({ assignedCount: result.count, videoCount: validVideos.length, studentCount: validStudents.length });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_bulk_assign_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Toplu atama yapılamadı." }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/videos/bulk-assign", handlePost);
