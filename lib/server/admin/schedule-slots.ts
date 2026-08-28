import { prisma } from "@/lib/server/prisma";
import { AdminCreateError } from "@/lib/server/admin/create-user";

const LABEL_PATTERN = /^\d{2}:\d{2}-\d{2}:\d{2}$/;

function validateLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) throw new AdminCreateError("Saat dilimi etiketi zorunludur.");
  // "HH:MM-HH:MM" formatı BİLEREK zorunlu — lib/schedule-time.ts >
  // parseSlotRange bu formatı varsayarak "şu an hangi ders" gibi zaman
  // karşılaştırmaları yapıyor (bkz. şemadaki not). Tamamen serbest bir
  // etiket ("Sabah Dersi" gibi) bu mantığı sessizce bozardı.
  if (!LABEL_PATTERN.test(trimmed)) {
    throw new AdminCreateError('Saat dilimi "SS:DD-SS:DD" formatında olmalı (örn. "16:00-17:00").');
  }
  return trimmed;
}

export async function listScheduleSlots(institutionId: string) {
  return prisma.scheduleSlotDefinition.findMany({ where: { institutionId }, orderBy: { createdAt: "asc" } });
}

// Yeni bir kurum onboard edilirken çağrılır (bkz.
// lib/server/platform/onboard-institution.ts) — eski sabit SCHEDULE_SLOTS
// listesiyle (lib/mock-data.ts) AYNI 4 saati varsayılan olarak oluşturur ki
// yönetici Ders Programı ekranını ilk açtığında bomboş bir saat listesiyle
// karşılaşmasın (mevcut kurumlar için AYNI doldurma migration'da yapıldı,
// bkz. prisma/migrations/20260828170000_add_schedule_slot_definition).
export async function createDefaultScheduleSlots(institutionId: string): Promise<void> {
  await prisma.scheduleSlotDefinition.createMany({
    data: ["16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00"].map((label) => ({ institutionId, label })),
    skipDuplicates: true,
  });
}

export async function createScheduleSlot(input: { institutionId: string; label: string }) {
  const label = validateLabel(input.label);
  const existing = await prisma.scheduleSlotDefinition.findFirst({ where: { institutionId: input.institutionId, label } });
  if (existing) throw new AdminCreateError(`Bu saat dilimi zaten var: "${label}".`, 409);
  return prisma.scheduleSlotDefinition.create({ data: { institutionId: input.institutionId, label } });
}

// Bir saat dilimini yeniden adlandırmak, o etikete SAHİP TÜM mevcut
// LessonSlot/TeacherDutySlot kayıtlarını da (aynı transaction'da) günceller
// — aksi halde bu alanlar serbest metin olduğundan referans kopar, o
// saatteki atamalar eski etikete bağlı "hayalet" kalır ve yeni listede hiç
// görünmez olur.
export async function renameScheduleSlot(input: { id: string; institutionId: string; label: string }) {
  const label = validateLabel(input.label);
  const current = await prisma.scheduleSlotDefinition.findUnique({ where: { id: input.id } });
  if (!current || current.institutionId !== input.institutionId) throw new AdminCreateError("Saat dilimi bulunamadı.", 404);
  if (current.label === label) return current;

  const collision = await prisma.scheduleSlotDefinition.findFirst({ where: { institutionId: input.institutionId, label } });
  if (collision) throw new AdminCreateError(`Bu saat dilimi zaten var: "${label}".`, 409);

  const [updated] = await prisma.$transaction([
    prisma.scheduleSlotDefinition.update({ where: { id: input.id }, data: { label } }),
    prisma.lessonSlot.updateMany({ where: { slot: current.label, branch: { institutionId: input.institutionId } }, data: { slot: label } }),
    prisma.teacherDutySlot.updateMany({ where: { slot: current.label, teacher: { institutionId: input.institutionId } }, data: { slot: label } }),
  ]);
  return updated;
}

export async function deleteScheduleSlot(id: string, institutionId: string): Promise<void> {
  const current = await prisma.scheduleSlotDefinition.findUnique({ where: { id } });
  if (!current || current.institutionId !== institutionId) throw new AdminCreateError("Saat dilimi bulunamadı.", 404);

  const [lessonUse, dutyUse] = await Promise.all([
    prisma.lessonSlot.findFirst({ where: { slot: current.label, branch: { institutionId } } }),
    prisma.teacherDutySlot.findFirst({ where: { slot: current.label, teacher: { institutionId } } }),
  ]);
  if (lessonUse || dutyUse) {
    throw new AdminCreateError("Bu saatte atanmış ders/nöbet kayıtları var, önce onları kaldırın.", 409);
  }

  await prisma.scheduleSlotDefinition.delete({ where: { id } });
}
