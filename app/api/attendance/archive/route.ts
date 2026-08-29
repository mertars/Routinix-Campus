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

    // ⚠️ Önceki sürüm HER submission için 2 ayrı sorgu (öğrenci listesi +
    // devam kaydı) çalıştırıyordu — 50 submission'da ~100 ekstra sorgu
    // demekti. Aynı sonucu üreten iki toplu sorguya indirgendi: TÜM ilgili
    // şubelerin öğrencileri bir seferde, TÜM ilgili tarihlerin devam
    // kayıtları bir seferde çekilip JS'te (şube+tarih) anahtarıyla gruplanıyor.
    const branchIds = [...new Set(submissions.map((s) => s.branchId))];
    const students = branchIds.length
      ? await prisma.student.findMany({ where: { branchId: { in: branchIds } }, select: { id: true, firstName: true, lastName: true, branchId: true } })
      : [];
    const nameById = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
    const branchIdByStudent = new Map(students.map((s) => [s.id, s.branchId]));
    const studentIds = students.map((s) => s.id);

    const dates = [...new Set(submissions.map((s) => s.date.getTime()))].map((t) => new Date(t));
    const records = studentIds.length && dates.length
      ? await prisma.attendanceRecord.findMany({
          where: { studentId: { in: studentIds }, date: { in: dates } },
          select: { studentId: true, status: true, date: true },
        })
      : [];
    const recordsByBranchDate = new Map<string, { studentId: string; status: string }[]>();
    for (const r of records) {
      const branchId = branchIdByStudent.get(r.studentId);
      if (!branchId) continue;
      const key = `${branchId}|${r.date.getTime()}`;
      const list = recordsByBranchDate.get(key) ?? [];
      list.push({ studentId: r.studentId, status: r.status });
      recordsByBranchDate.set(key, list);
    }

    const entries = submissions.map((submission) => {
      const key = `${submission.branchId}|${submission.date.getTime()}`;
      const submissionRecords = recordsByBranchDate.get(key) ?? [];
      return {
        id: submission.id,
        teacherName: `${submission.teacher.firstName} ${submission.teacher.lastName}`,
        branchName: submission.branch.name,
        date: submission.date.toISOString().slice(0, 10),
        submittedAt: submission.createdAt.toISOString(),
        records: submissionRecords.map((r) => ({ studentName: nameById.get(r.studentId) ?? "Bilinmiyor", status: r.status })),
      };
    });

    return NextResponse.json({ entries });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("attendance_archive_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/attendance/archive", handleGet);
