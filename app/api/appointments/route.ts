import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/appointments — öğrenci bir öğretmenden birebir etüt talep eder.
async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, teacherId, topic, day, slot } = body as {
      studentId?: string;
      teacherId?: string;
      topic?: string;
      day?: string;
      slot?: string;
    };

    if (!studentId || !teacherId || !topic?.trim() || !day || !slot) {
      return NextResponse.json({ error: "studentId, teacherId, topic, day ve slot zorunludur." }, { status: 400 });
    }

    const [student, teacher] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId }, select: { id: true } }),
      prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true } }),
    ]);
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    if (!teacher) return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });

    const conflict = await prisma.appointmentRequest.findFirst({ where: { teacherId, day, slot, status: "APPROVED" } });
    if (conflict) {
      return NextResponse.json({ error: "Bu saat başka bir öğrenciye onaylanmış, lütfen başka bir saat seçin." }, { status: 409 });
    }

    const appointment = await prisma.appointmentRequest.create({
      data: { studentId, teacherId, topic: topic.trim(), day, slot },
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    logger.error("appointment_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// GET /api/appointments?studentId=X  veya  ?teacherId=X
async function handleGet(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId");
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    if (!studentId && !teacherId) {
      return NextResponse.json({ error: "studentId veya teacherId parametrelerinden biri zorunludur." }, { status: 400 });
    }

    const appointments = await prisma.appointmentRequest.findMany({
      where: studentId ? { studentId } : { teacherId: teacherId! },
      include: {
        student: { select: { firstName: true, lastName: true } },
        teacher: { select: { firstName: true, lastName: true } },
      },
      orderBy: { requestedAt: "desc" },
    });

    return NextResponse.json({ appointments });
  } catch (error) {
    logger.error("appointments_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/appointments", handlePost);
export const GET = withApiLogging("GET /api/appointments", handleGet);
