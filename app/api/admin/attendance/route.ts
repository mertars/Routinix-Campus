import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// bkz. app/api/admin/attendance-today/route.ts (bu ucun eski adı) —
// FAZ 4'te "sadece bugün" kısıtlaması kaldırılıp isteğe bağlı date/branchId
// filtresine genişletildi, bu yüzden yol adı da (attendance-today ->
// attendance) daha doğru bir isme taşındı. Tek tüketici
// components/principal/tabs/attendance-command.tsx olduğu için güvenli.
function parseDateParam(value: string | null): Date {
  const date = value ? new Date(value) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

const TO_LOWER: Record<string, "present" | "absent" | "late"> = { PRESENT: "present", ABSENT: "absent", LATE: "late" };
const TO_UPPER: Record<string, "PRESENT" | "ABSENT" | "LATE"> = { present: "PRESENT", absent: "ABSENT", late: "LATE" };

// GET /api/admin/attendance?date=YYYY-MM-DD&branchId=X — kurumun (isteğe
// bağlı bir şubeye daraltılmış) belirli bir gündeki yoklama durumu. Aynı
// AttendanceRecord tablosunu (öğretmenin Canlı Yoklama ekranıyla) paylaşır
// — iki panel arasında çelişkili veri yok.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const date = parseDateParam(request.nextUrl.searchParams.get("date"));
    const branchId = request.nextUrl.searchParams.get("branchId") || undefined;

    const [students, records] = await Promise.all([
      prisma.student.findMany({
        where: { institutionId: session.institutionId, branchId, isActive: true },
        select: { id: true, firstName: true, lastName: true, branch: { select: { name: true } } },
        orderBy: [{ firstName: "asc" }],
      }),
      prisma.attendanceRecord.findMany({
        where: { date, student: { institutionId: session.institutionId, branchId } },
        select: { studentId: true, status: true },
      }),
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
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_attendance_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/admin/attendance — yönetici tek bir öğrencinin belirli bir
// GÜNKÜ (varsayılan: bugün) durumunu doğrudan düzeltir — geçmiş bir günü
// görüntülerken de kullanılabilir (retroaktif düzeltme). Öğretmenin
// sınıf-geneli Yoklama gönderimiyle aynı AttendanceRecord satırı üzerinde
// çalışır.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { studentId, status, date: dateParam } = body as { studentId?: string; status?: string; date?: string };
    if (!studentId || !status || !(status in TO_UPPER)) {
      return NextResponse.json({ error: "studentId ve geçerli bir status ('present'|'absent'|'late') zorunludur." }, { status: 400 });
    }
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student || student.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    }
    const date = parseDateParam(dateParam ?? null);
    await prisma.attendanceRecord.upsert({
      where: { studentId_date: { studentId, date } },
      update: { status: TO_UPPER[status] },
      create: { studentId, date, status: TO_UPPER[status] },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_attendance_update_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/attendance", handleGet);
export const POST = withApiLogging("POST /api/admin/attendance", handlePost);
