import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { getAbsenceSummaries } from "@/lib/server/attendance/absence-summary";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Kampüs V2 Part 4 — Yönetici Yoklama Matrisi artık SALT OKUNURDUR: yoklama
// durumunu SADECE dersi işleyen öğretmen değiştirebilir (bkz. POST
// /api/attendance). Bu dosyada daha önce var olan POST /api/admin/attendance
// (yöneticinin bir öğrencinin durumunu doğrudan düzeltebildiği uç) Part 4
// isteğiyle BİLEREK KALDIRILDI — yönetici artık sadece görüntüler.
function parseDateParam(value: string | null): Date {
  const date = value ? new Date(value) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

const TO_LOWER: Record<string, "present" | "absent" | "late"> = { PRESENT: "present", ABSENT: "absent", LATE: "late" };

// GET /api/admin/attendance?branchId=X&date=YYYY-MM-DD&slot=HH:MM-HH:MM —
// yöneticinin seçtiği TEK bir dersin (şube+gün+saat) salt okunur yoklama
// dökümü. Her öğrenci satırına, o dersten BAĞIMSIZ (tüm zamanların) iki ayrı
// Prisma aggregation'ı ile hesaplanmış "Günlük Devamsızlık" / "Ders
// Devamsızlığı" toplamı da eklenir (bkz. lib/server/attendance/absence-summary.ts).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const date = parseDateParam(request.nextUrl.searchParams.get("date"));
    const branchId = request.nextUrl.searchParams.get("branchId");
    const slot = request.nextUrl.searchParams.get("slot");
    if (!branchId || !slot) {
      return NextResponse.json({ error: "branchId ve slot parametreleri zorunludur." }, { status: 400 });
    }
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { institutionId: true } });
    if (!branch || branch.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    }

    const students = await prisma.student.findMany({
      where: { institutionId: session.institutionId, branchId, isActive: true },
      select: { id: true, firstName: true, lastName: true, branch: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }],
    });
    const studentIds = students.map((s) => s.id);

    const [records, summaries] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { date, slot, studentId: { in: studentIds } },
        select: { studentId: true, status: true },
      }),
      getAbsenceSummaries(studentIds),
    ]);
    const statusByStudent = new Map(records.map((r) => [r.studentId, TO_LOWER[r.status] ?? "unmarked"]));

    const rows = students.map((s) => {
      const summary = summaries.get(s.id) ?? { dailyAbsenceCount: 0, lessonAbsenceCount: 0 };
      return {
        studentId: s.id,
        studentName: `${s.firstName} ${s.lastName}`,
        branch: s.branch.name,
        status: statusByStudent.get(s.id) ?? ("unmarked" as const),
        dailyAbsenceCount: summary.dailyAbsenceCount,
        lessonAbsenceCount: summary.lessonAbsenceCount,
      };
    });

    return NextResponse.json({ rows });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_attendance_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/attendance", handleGet);
