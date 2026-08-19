"use client";

import { useEffect, useState } from "react";
import { useRole } from "./role-context";
import { INITIAL_BRANCHES, SCHEDULE_DAYS, SCHEDULE_SLOTS, type ScheduleAssignment } from "./mock-data";

export type ScopeBranch = { id: string; name: string; grade?: number; track?: string | null };

// Demo modunda gerçek bir login/oturum yok — tek persona ismi tek gerçek
// Teacher.id'ye sabit eşlenir (prisma/seed.ts'teki TEACHER_ID_BY_NAME ile
// birebir aynı). Gerçek bir auth eklenince bu eşleme oturumdan gelecek.
const TEACHER_ID_BY_PERSONA_NAME: Record<string, string> = {
  "İrfan Hoca": "1",
  "Selin Hoca": "2",
  "Kemal Hoca": "3",
  "Ayşe Hoca": "4",
  "Zehra Rehber": "5",
};

// Öğretmen paneli, oturum açan personaya göre SADECE kendi ders verdiği
// şubeleri ve branşını gösterir — teachingBranches (gerçek Postgres ilişkisi,
// bkz. app/api/teachers/[id]) yetki kısıtlamasının tek kaynağı.
export function useTeacherScope() {
  const { persona } = useRole();
  const teacherName = persona?.name ?? "İrfan Hoca";
  const teacherId = TEACHER_ID_BY_PERSONA_NAME[teacherName] ?? "1";

  const [subject, setSubject] = useState("Genel");
  const [assignedBranches, setAssignedBranches] = useState<ScopeBranch[]>([]);
  const [mySchedule, setMySchedule] = useState<ScheduleAssignment[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/teachers/${encodeURIComponent(teacherId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setSubject(data.subject ?? "Genel");
        setAssignedBranches(data.assignedBranches ?? []);
      })
      .catch(() => {
        // sessiz — boş kapsam gösterilir
      });
    fetch(`/api/lesson-slots?teacherId=${encodeURIComponent(teacherId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const rows: ScheduleAssignment[] = (data.slots ?? []).map(
          (row: { id: string; branchId: string; day: string; slot: string; subject: string; teacherName: string }) => ({
            id: row.id,
            branchId: row.branchId,
            day: row.day as ScheduleAssignment["day"],
            slot: row.slot as ScheduleAssignment["slot"],
            teacherName: row.teacherName,
            subject: row.subject,
          })
        );
        setMySchedule(rows);
      })
      .catch(() => {
        // sessiz — boş program gösterilir
      });
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  const staffRecord = { id: teacherId, name: teacherName };

  return { teacherName, teacherId, subject, staffRecord, assignedBranches, mySchedule };
}

function parseSlotRange(slot: string): [number, number] {
  const [start, end] = slot.split("-");
  const toMinutes = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };
  return [toMinutes(start), toMinutes(end)];
}

const JS_DAY_TO_TR: Record<number, (typeof SCHEDULE_DAYS)[number] | null> = {
  0: null, // Pazar — dershane haftalık programında yok
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: null, // Cumartesi — programda yok
};

// Gerçek saatle öğretmenin haftalık programını karşılaştırıp "şu an dersi var
// mı" sorusunu canlı olarak (60 sn'de bir yenilenerek) yanıtlar.
export function useCurrentLesson(mySchedule: ScheduleAssignment[]) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const today = JS_DAY_TO_TR[now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const current = today
    ? mySchedule.find((row) => {
        if (row.day !== today) return false;
        const [start, end] = parseSlotRange(row.slot);
        return nowMinutes >= start && nowMinutes < end;
      })
    : undefined;

  if (current) {
    const branch = INITIAL_BRANCHES.find((b) => b.id === current.branchId);
    return { isLive: true as const, branchName: branch?.name ?? current.branchId, slot: current.slot, subject: current.subject };
  }

  // Aktif ders yoksa, haftanın geri kalanında sıradaki dersi bul (bugünden
  // başlayıp SCHEDULE_DAYS sırasını takip ederek).
  const dayIndex = SCHEDULE_DAYS.findIndex((d) => d === today);
  const orderedDays = dayIndex >= 0 ? [...SCHEDULE_DAYS.slice(dayIndex), ...SCHEDULE_DAYS.slice(0, dayIndex)] : SCHEDULE_DAYS;

  for (const day of orderedDays) {
    const candidates = mySchedule
      .filter((row) => row.day === day)
      .filter((row) => (day === today ? parseSlotRange(row.slot)[0] > nowMinutes : true))
      .sort((a, b) => SCHEDULE_SLOTS.indexOf(a.slot) - SCHEDULE_SLOTS.indexOf(b.slot));
    if (candidates.length > 0) {
      const next = candidates[0];
      const branch = INITIAL_BRANCHES.find((b) => b.id === next.branchId);
      return { isLive: false as const, branchName: branch?.name ?? next.branchId, slot: next.slot, day: next.day, subject: next.subject };
    }
  }

  return { isLive: false as const, branchName: null, slot: null, day: null, subject: null };
}
