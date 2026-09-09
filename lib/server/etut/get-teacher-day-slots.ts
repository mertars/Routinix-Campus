import { prisma } from "@/lib/server/prisma";
import { computeAvailableSlots } from "@/lib/server/etut/compute-available-slots";

const DEFAULT_DURATION_MINUTES = 20;

// Bir öğretmenin bir gün için ŞU AN rezerve edilebilir slotlarını hesaplar.
// Hem GET /api/etut/available-slots (öğrenciye listelemek için) HEM DE
// POST /api/appointments (yazma anında yeniden doğrulamak için) AYNI
// fonksiyonu çağırır — tek gerçek kaynak, iki ayrı hesaplama mantığı yok.
export type SlotQueryOptions = {
  /** Bu randevuyu hesaba katma (kendi slotunu "dolu" saymasın). */
  excludeRequestId?: string;
  /**
   * BEKLEYEN talepler slotu dolu sayılsın mı?
   *
   * ⚠️ Bu ayrım bir KİLİTLENMEDEN doğdu. Fonksiyon iki farklı soruya
   * tek cevap veriyordu:
   *
   *   • "Öğrenci hangi slotu isteyebilir?" → bekleyen talep DOLU
   *     saymalı, yoksa beş öğrenci aynı slota yığılır.
   *   • "Öğretmen bu randevuyu onaylayabilir mi?" → bekleyen talep
   *     dolu SAYILMAMALI; bir talep taahhüt değildir.
   *
   * İkisi de bekleyeni dolu sayınca şu oluyordu: aynı slot için iki
   * talep geldiğinde öğretmen HİÇBİRİNİ onaylayamıyor, ikisi de "bu
   * saat artık müsait değil" (409) alıyordu (ölçüldü). Öğretmenin
   * çıkış yolu yoktu ve ekran bunu söylemiyordu.
   */
  pendingBlocks?: boolean;
};

export async function getTeacherDaySlots(
  institutionId: string,
  teacherId: string,
  day: string,
  options: SlotQueryOptions = {}
): Promise<string[]> {
  const { excludeRequestId, pendingBlocks = true } = options;
  const blockingStatuses = pendingBlocks ? (["PENDING", "APPROVED"] as const) : (["APPROVED"] as const);
  const [setting, teacher, ranges, occupied] = await Promise.all([
    prisma.etutSetting.findUnique({ where: { institutionId } }),
    prisma.teacher.findUnique({ where: { id: teacherId }, select: { etutBreakMinutes: true } }),
    prisma.teacherEtutAvailability.findMany({ where: { teacherId, day }, select: { startTime: true, endTime: true } }),
    prisma.appointmentRequest.findMany({
      where: { teacherId, day, status: { in: [...blockingStatuses] }, ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}) },
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
