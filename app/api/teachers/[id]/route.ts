import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireInstitution, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/teachers/[id] — useTeacherScope'un tek gerçek veri kaynağı.
// teachingBranches (çoka-çok "ders veriyor" ilişkisi), advisorBranches'ten
// (tek şubelik danışmanlık) BAĞIMSIZDIR — bkz. prisma/schema.prisma notu.
// Erişim: öğretmenin kendisi (kendi id'si) ya da aynı kurumdaki bir yönetici.
async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const teacher = await prisma.teacher.findUnique({
      where: { id: params.id },
      include: {
        teachingBranches: { orderBy: { name: "asc" } },
        advisorBranches: { select: { id: true, name: true } },
      },
    });
    if (!teacher) return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });

    requireInstitution(session, teacher.institutionId);
    if (session.role === "TEACHER") assertOwnsSelf(session, teacher.id);
    else if (session.role === "STUDENT" || session.role === "PARENT") {
      throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
    }

    return NextResponse.json({
      id: teacher.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      subject: teacher.subject,
      mobilePhone: teacher.mobilePhone,
      assignedBranches: teacher.teachingBranches.map((b) => ({ id: b.id, name: b.name, grade: b.grade, track: b.track })),
      advisorBranchIds: teacher.advisorBranches.map((b) => b.id),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("teacher_detail_failed", { teacherId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/teachers/[id]", handleGet);
