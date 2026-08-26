"use client";

import { Modal } from "@/components/ui/modal";
import { WeeklyGrid, type WeeklyGridCell } from "@/components/teacher/weekly-grid";
import type { ScheduleAssignment, ScheduleDay, ScheduleSlot } from "@/lib/mock-data";

// "Tüm Programı Gör" — öğretmen panelindeki AYNI WeeklyGrid bileşenini
// (masaüstünde 5x4 matris, mobilde gün bazlı akordiyon) tam genişlikli bir
// modal içinde yeniden kullanır — ayrı bir haftalık tablo mantığı YOKTUR.
export function FullWeekScheduleModal({
  isOpen,
  onClose,
  schedule,
}: {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduleAssignment[];
}) {
  function getCell(day: ScheduleDay, slot: ScheduleSlot): WeeklyGridCell {
    const row = schedule.find((item) => item.day === day && item.slot === slot);
    if (!row) return null;
    return { label: `${row.subject} · ${row.teacherName}`, tone: "border-brand-500/40 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-600/10" };
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Haftalık Ders Programı" widthClassName="max-w-4xl">
      <WeeklyGrid getCell={getCell} />
    </Modal>
  );
}
