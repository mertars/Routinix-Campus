import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { computeAttendanceRateFromCounts } from "@/lib/attendance/status";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";

// GET /api/parent/me — oturum açmış Veli'nin kendisi + bağlı öğrencilerinin
// özet performansı. Kimlik URL'den/body'den DEĞİL, httpOnly oturum
// cookie'sinden (imzalı JWT) gelir. Öğrenci verisi BİLEREK genel amaçlı
// /api/students/[id] üzerinden değil, doğrudan burada — session'daki
// parentId'ye bağlı ParentStudent ilişkisiyle sınırlı olarak — hesaplanır;
// böylece bir veli, URL'deki id'yi değiştirerek başka bir öğrencinin
// verisine erişemez.
async function handleGet() {
  let session;
  try {
    session = await requireSession();
    requireRole(session, "parent");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const parent = await prisma.parent.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      students: {
        select: {
          student: {
            select: { id: true, firstName: true, lastName: true, targetNet: true, branch: { select: { name: true, grade: true } } },
          },
        },
      },
    },
  });
  if (!parent) {
    return NextResponse.json({ error: "Veli kaydı bulunamadı." }, { status: 404 });
  }

  const students = await Promise.all(
    parent.students.map(async ({ student }) => {
      const [attendanceCounts, latestExam] = await Promise.all([
        // ⚠️ Satırlar DEĞİL, sayılar çekilir.
        //
        // Burada eskiden öğrencinin TÜM yoklama kayıtları çekiliyordu.
        // Ölçüldü: 3 eğitim yılı = 1.925 satır ve bu tek uç 630-960 ms
        // sürüyordu — üstelik veli panelinin gördüğü TEK uç bu. Üç
        // çocuklu bir veli üç saniye bekliyordu. Oran için satırların
        // kendisi gerekmiyor (bkz. computeAttendanceRateFromCounts).
        prisma.attendanceRecord.groupBy({
          by: ["status"],
          where: { studentId: student.id },
          _count: { _all: true },
        }),
        // ⚠️ "Son deneme" SINAV TARİHİNE göre bulunur, examId'ye göre değil.
        //
        // Eskiden `orderBy: { examId: "desc" }` yazıyordu; examId bir
        // cuid ve OLUŞTURULMA sırasıyla korelasyonlu — sınav TARİHİYLE
        // değil. Müdür eski tarihli bir denemenin sonuçlarını sonradan
        // girdiğinde o deneme "son deneme" gibi görünüyordu.
        prisma.exam.findFirst({
          where: { results: { some: { studentId: student.id } } },
          orderBy: { examDate: "desc" },
          select: { id: true },
        }),
      ]);

      // Yalnızca SON denemenin satırları toplanır; tüm geçmiş değil.
      const netAgg = latestExam
        ? await prisma.examNetResult.aggregate({
            where: { studentId: student.id, examId: latestExam.id },
            _sum: { net: true },
          })
        : null;
      const actualNet = netAgg?._sum.net != null ? Math.round(netAgg._sum.net * 100) / 100 : null;

      const counts: Record<string, number> = {};
      for (const row of attendanceCounts) counts[row.status] = row._count._all;

      return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        branchName: student.branch.name,
        grade: student.branch.grade,
        targetNet: student.targetNet,
        actualNet,
        attendanceRate: computeAttendanceRateFromCounts(counts),
      };
    })
  );

  return NextResponse.json({
    id: parent.id,
    name: `${parent.firstName} ${parent.lastName}`.trim(),
    students,
  });
}

export const GET = withApiLogging("GET /api/parent/me", handleGet);
