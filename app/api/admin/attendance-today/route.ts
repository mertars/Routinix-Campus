import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function today(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

const TO_LOWER: Record<string, "present" | "absent" | "late"> = { PRESENT: "present", ABSENT: "absent", LATE: "late" };
const TO_UPPER: Record<string, "PRESENT" | "ABSENT" | "LATE"> = { present: "PRESENT", absent: "ABSENT", late: "LATE" };

// GET /api/admin/attendance-today — TÜM kurumun bugünkü yoklama durumu, şube
// bazında değil kurum geneli. Aynı AttendanceRecord tablosunu (öğretmenin
// Canlı Yoklama ekranıyla) paylaşır — iki panel arasında çelişkili veri yok.
async function handleGet() {
  try {
    const [students, records] = await Promise.all([
      prisma.student.findMany({ select: { id: true, firstName: true, lastName: true, branch: { select: { name: true } } } }),
      prisma.attendanceRecord.findMany({ where: { date: today() }, select: { studentId: true, status: true } }),
    ]);
    const statusByStudent = new Map(records.map((r) => [r.studentId, TO_LOWER[r.status] ?? "unmarked"]));

    const rows = students.map((s) => ({
      studentId: s.id,
      studentName: `${s.firstName} ${s.lastName}`,
      branch: s.branch.name,
      status: statusByStudent.get(s.id) ?? ("unmarked" as const),
    }));

    return NextResponse.json({ rows });
  } catch (error) {
    logger.error("admin_attendance_today_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/admin/attendance-today — yönetici tek bir öğrencinin bugünkü
// durumunu doğrudan düzeltir (öğretmenin sınıf-geneli Yoklama gönderimiyle
// aynı AttendanceRecord satırı üzerinde çalışır).
async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, status } = body as { studentId?: string; status?: string };
    if (!studentId || !status || !(status in TO_UPPER)) {
      return NextResponse.json({ error: "studentId ve geçerli bir status ('present'|'absent'|'late') zorunludur." }, { status: 400 });
    }
    const date = today();
    await prisma.attendanceRecord.upsert({
      where: { studentId_date: { studentId, date } },
      update: { status: TO_UPPER[status] },
      create: { studentId, date, status: TO_UPPER[status] },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("admin_attendance_today_update_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/attendance-today", handleGet);
export const POST = withApiLogging("POST /api/admin/attendance-today", handlePost);
