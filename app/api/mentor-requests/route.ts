import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/mentor-requests?studentId=X — öğrencinin KENDİ gönderdiği
// mentorluk talepleri + durumları. Talep ONAYLANMIŞSA mezunun iletişim
// bilgisi (AlumniProfile.contactPhone) burada açılır — REDDEDİLMİŞ/
// BEKLEYEN taleplerde asla gösterilmez.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId parametresi zorunludur." }, { status: 400 });
    requireRole(session, "student");
    assertOwnsSelf(session, studentId);

    const requests = await prisma.mentorRequest.findMany({
      where: { requesterStudentId: studentId },
      include: { alumniProfile: { include: { student: { select: { firstName: true, lastName: true } } } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        alumniProfileId: r.alumniProfileId,
        status: r.status,
        message: r.message,
        createdAt: r.createdAt,
        mentorName: `${r.alumniProfile.student.firstName} ${r.alumniProfile.student.lastName}`,
        contactPhone: r.status === "APPROVED" ? r.alumniProfile.contactPhone : null,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("mentor_requests_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/mentor-requests — { alumniProfileId, message? } — öğrenci
// kendi adına bir mezun-mentora destek talebi gönderir.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const body = (await request.json()) as { alumniProfileId?: string; message?: string };
    if (!body.alumniProfileId) return NextResponse.json({ error: "alumniProfileId zorunludur." }, { status: 400 });

    const profile = await prisma.alumniProfile.findUnique({
      where: { id: body.alumniProfileId },
      select: { isMentor: true, student: { select: { institutionId: true } } },
    });
    if (!profile || profile.student.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Mezun profili bulunamadı." }, { status: 404 });
    }
    if (!profile.isMentor) return NextResponse.json({ error: "Bu mezun mentorluk vermiyor." }, { status: 400 });

    const existingPending = await prisma.mentorRequest.findFirst({
      where: { alumniProfileId: body.alumniProfileId, requesterStudentId: session.sub, status: "PENDING" },
    });
    if (existingPending) return NextResponse.json({ error: "Bu mentora zaten bekleyen bir talebin var." }, { status: 409 });

    const created = await prisma.mentorRequest.create({
      data: { alumniProfileId: body.alumniProfileId, requesterStudentId: session.sub, message: body.message?.trim() || undefined },
    });
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("mentor_request_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/mentor-requests", handleGet);
export const POST = withApiLogging("POST /api/mentor-requests", handlePost);
