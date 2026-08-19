import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/teachers/[id] — useTeacherScope'un tek gerçek veri kaynağı.
// teachingBranches (çoka-çok "ders veriyor" ilişkisi), advisorBranches'ten
// (tek şubelik danışmanlık) BAĞIMSIZDIR — bkz. prisma/schema.prisma notu.
async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: params.id },
      include: {
        teachingBranches: { orderBy: { name: "asc" } },
        advisorBranches: { select: { id: true, name: true } },
      },
    });
    if (!teacher) return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });

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
    logger.error("teacher_detail_failed", { teacherId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/teachers/[id]", handleGet);
