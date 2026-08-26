import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

// GET /api/attendance/archive?teacherId=X&limit=N
// teacherId verilirse o öğretmenin geçmiş tüm yoklama gönderimlerini (öğrenci
// bazlı kayıtlarla birlikte) döner — sadece o öğretmenin KENDİSİ ya da bir
// yönetici görebilir. teacherId verilmezse TÜM öğretmenlerin son gönderimleri
// döner (yönetici canlı akışı için) — bu durumda SADECE yönetici erişebilir.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    const limit = Math.min(50, Number(request.nextUrl.searchParams.get("limit") ?? "20") || 20);

    if (teacherId) {
      if (session.role === "TEACHER") {
        if (session.sub !== teacherId) throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
      } else {
        requireRole(session, "principal");
      }
      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } });
      if (!teacher || teacher.institutionId !== session.institutionId) {
        return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
      }
    } else {
      requireRole(session, "principal");
    }

    const submissions = await prisma.attendanceSubmission.findMany({
      where: {
        teacherId: teacherId ?? undefined,
        teacher: { institutionId: session.institutionId },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        teacher: { select: { firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    const entries = await Promise.all(
      submissions.map(async (submission) => {
        const students = await prisma.student.findMany({
          where: { branchId: submission.branchId },
          select: { id: true, firstName: true, lastName: true },
        });
        const records = await prisma.attendanceRecord.findMany({
          where: { date: submission.date, studentId: { in: students.map((s) => s.id) } },
          select: { studentId: true, status: true },
        });
        const studentById = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));

        return {
          id: submission.id,
          teacherName: `${submission.teacher.firstName} ${submission.teacher.lastName}`,
          branchName: submission.branch.name,
          date: submission.date.toISOString().slice(0, 10),
          submittedAt: submission.createdAt.toISOString(),
          records: records.map((r) => ({ studentName: studentById.get(r.studentId) ?? "Bilinmiyor", status: r.status })),
        };
      })
    );

    return NextResponse.json({ entries });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("attendance_archive_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/attendance/archive", handleGet);
