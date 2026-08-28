"use client";

import { useEffect, useState } from "react";
import { SCHEDULE_DAYS, type ScheduleAssignment } from "./mock-data";
import { parseSlotRange } from "./schedule-time";

export type ScopeBranch = { id: string; name: string; grade?: number; track?: string | null };

// Öğretmen paneli, /api/auth/session'dan gelen GERÇEK oturum kimliğine göre
// SADECE kendi ders verdiği şubeleri ve branşını gösterir — teachingBranches
// (gerçek Postgres ilişkisi, bkz. app/api/teachers/[id]) yetki kısıtlamasının
// tek kaynağı. teacherId, httpOnly oturum cookie'si sunucuda çözülene kadar
// kısa süreliğine boş kalır; altındaki veri effect'i boşken hiç istek atmaz.
export function useTeacherScope() {
  const [teacherId, setTeacherId] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [subject, setSubject] = useState("Genel");
  const [assignedBranches, setAssignedBranches] = useState<ScopeBranch[]>([]);
  const [mySchedule, setMySchedule] = useState<ScheduleAssignment[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.id) return;
        setTeacherId(data.id);
        setTeacherName(data.name ?? "");
      })
      .catch(() => {
        // sessiz — oturum çözülemedi, kapsam boş kalır
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!teacherId) return;
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
          (row: { id: string; branchId: string; branchName: string; day: string; slot: string; subject: string; teacherName: string }) => ({
            id: row.id,
            branchId: row.branchId,
            branchName: row.branchName,
            day: row.day as ScheduleAssignment["day"],
            slot: row.slot,
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
    return { isLive: true as const, branchName: current.branchName, slot: current.slot, subject: current.subject };
  }

  // Aktif ders yoksa, haftanın geri kalanında sıradaki dersi bul (bugünden
  // başlayıp SCHEDULE_DAYS sırasını takip ederek).
  const dayIndex = SCHEDULE_DAYS.findIndex((d) => d === today);
  const orderedDays = dayIndex >= 0 ? [...SCHEDULE_DAYS.slice(dayIndex), ...SCHEDULE_DAYS.slice(0, dayIndex)] : SCHEDULE_DAYS;

  for (const day of orderedDays) {
    const candidates = mySchedule
      .filter((row) => row.day === day)
      .filter((row) => (day === today ? parseSlotRange(row.slot)[0] > nowMinutes : true))
      .sort((a, b) => parseSlotRange(a.slot)[0] - parseSlotRange(b.slot)[0]);
    if (candidates.length > 0) {
      const next = candidates[0];
      return { isLive: false as const, branchName: next.branchName, slot: next.slot, day: next.day, subject: next.subject };
    }
  }

  return { isLive: false as const, branchName: null, slot: null, day: null, subject: null };
}
