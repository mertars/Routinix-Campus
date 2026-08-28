import { prisma } from "@/lib/server/prisma";
import { computeAvailableSlots } from "@/lib/server/etut/compute-available-slots";

const DEFAULT_DURATION_MINUTES = 20;

// Bir öğretmenin bir gün için ŞU AN rezerve edilebilir slotlarını hesaplar.
// Hem GET /api/etut/available-slots (öğrenciye listelemek için) HEM DE
// POST /api/appointments (yazma anında yeniden doğrulamak için) AYNI
// fonksiyonu çağırır — tek gerçek kaynak, iki ayrı hesaplama mantığı yok.
export async function getTeacherDaySlots(
  institutionId: string,
  teacherId: string,
  day: string,
  excludeRequestId?: string
): Promise<string[]> {
  const [setting, teacher, ranges, occupied] = await Promise.all([
    prisma.etutSetting.findUnique({ where: { institutionId } }),
    prisma.teacher.findUnique({ where: { id: teacherId }, select: { etutBreakMinutes: true } }),
    prisma.teacherEtutAvailability.findMany({ where: { teacherId, day }, select: { startTime: true, endTime: true } }),
    prisma.appointmentRequest.findMany({
      where: { teacherId, day, status: { in: ["PENDING", "APPROVED"] }, ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}) },
      select: { slot: true },
    }),
  ]);

  const occupiedSlots = occupied
    .map((o) => o.slot.split("-"))
    .filter((parts): parts is [string, string] => parts.length === 2)
    .map(([startTime, endTime]) => ({ startTime, endTime }));

  return computeAvailableSlots({
    ranges,
    durationMinutes: setting?.durationMinutes ?? DEFAULT_DURATION_MINUTES,
    breakMinutes: teacher?.etutBreakMinutes ?? 10,
    occupiedSlots,
  });
}
