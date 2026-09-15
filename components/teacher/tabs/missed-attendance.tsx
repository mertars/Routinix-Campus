"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlarmClock, Check, CheckCheck, Clock, FileText, Loader2, Save, Users, X } from "lucide-react";
import { ATTENDANCE_LABEL, type AttendanceStatus } from "@/lib/attendance/status";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// UNUTULANLAR — öğretmenin geçmişte girmediği KENDİ yoklamaları.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-15): yönetici "yoklamayı hocaya hatırlat"
// diyordu, bildirim öğretmene ulaşıyordu ama öğretmen o yoklamayı GİREMİYORDU
// — Canlı Yoklama yalnızca BUGÜNÜN ders saatlerini sunuyor. Hatırlatma
// döngüsü tam da burada kopuyordu (bkz.
// lib/server/attendance/teacher-missing-attendance.ts'teki ayrıntı).
//
// Kapsam BİLEREK dar: liste sunucuda öğretmenin KENDİ LessonSlot'larından
// üretilir, yani "derse girip yoklama almadığı" dersler. Öğretmen buradan
// başkasının dersine ya da programında olmayan bir saate yoklama giremez.
// ----------------------------------------------------------------------------

type MissedLesson = {
  date: string;
  dayName: string;
  branchId: string;
  branchName: string;
  subject: string;
  slot: string;
  studentCount: number;
  daysAgo: number;
};

type RosterStudent = { id: string; firstName: string; lastName: string };

const STATUS_BUTTONS: { id: AttendanceStatus; icon: typeof Check }[] = [
  { id: "PRESENT", icon: Check },
  { id: "LATE", icon: Clock },
  { id: "EXCUSED", icon: FileText },
  { id: "ABSENT", icon: X },
];

const STATUS_STYLES: Record<AttendanceStatus | "unmarked", string> = {
  EXCUSED: "bg-sky-600 text-white",
  PRESENT: "bg-green-600 text-white",
  ABSENT: "bg-rose-600 text-white",
  LATE: "bg-brand-600 text-white",
  unmarked: "bg-white text-espresso-muted dark:bg-white/5 dark:text-cream/40",
};

function agoLabel(daysAgo: number): string {
  if (daysAgo === 1) return "dün";
  if (daysAgo === 2) return "evvelsi gün";
  return `${daysAgo} gün önce`;
}

function lessonKey(l: MissedLesson): string {
  return `${l.date}|${l.branchId}|${l.slot}`;
}

function MissedLessonCard({ lesson, onDone }: { lesson: MissedLesson; onDone: () => void }) {
  const { showError, showSuccess } = useToast();
  const [open, setOpen] = useState(false);
  const [roster, setRoster] = useState<RosterStudent[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus | "unmarked">>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || roster) return;
    fetch(`/api/students?branchId=${encodeURIComponent(lesson.branchId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const list: RosterStudent[] = d.students ?? [];
        setRoster(list);
        // Varsayılan "Geldi" DEĞİL: geçmişe dönük giriş yapan öğretmenin
        // hatırlamadan toplu onaylamasını kolaylaştırmak yanlış veri üretir.
        setStatuses(Object.fromEntries(list.map((s) => [s.id, "unmarked" as const])));
      })
      .catch(() => showError("Sınıf listesi yüklenemedi."));
  }, [open, roster, lesson.branchId, showError]);

  const unmarked = roster ? roster.filter((s) => statuses[s.id] === "unmarked").length : 0;

  async function save() {
    if (!roster || roster.length === 0) return;
    if (unmarked > 0) {
      showError(`${unmarked} öğrenci işaretlenmedi — yoklama eksik kaydedilemez.`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: lesson.branchId,
          date: lesson.date,
          slot: lesson.slot,
          records: roster.map((s) => ({ studentId: s.id, status: statuses[s.id] as AttendanceStatus })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Yoklama kaydedilemedi.");
      showSuccess(`${lesson.branchName} · ${lesson.dayName} yoklaması kaydedildi.`);
      onDone();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Yoklama kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className="overflow-hidden rounded-2xl border border-hairline bg-white dark:border-white/10 dark:bg-midnight-card/50"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[44px] items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <AlarmClock className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-espresso dark:text-cream">
            {lesson.branchName} · {lesson.subject}
          </span>
          <span className="block truncate text-[11.5px] text-espresso-muted dark:text-cream/45">
            {lesson.dayName} {lesson.slot} · {agoLabel(lesson.daysAgo)} · {lesson.studentCount} öğrenci
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-cream-card px-2.5 py-1 text-[11px] font-semibold text-espresso-muted dark:bg-white/5 dark:text-cream/50">
          {open ? "Kapat" : "Gir"}
        </span>
      </button>

      {open && (
        <div className="border-t border-hairline px-4 py-3 dark:border-white/10">
          {!roster ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
            </div>
          ) : roster.length === 0 ? (
            <p className="py-4 text-center text-xs text-espresso-muted dark:text-cream/40">Bu şubede aktif öğrenci yok.</p>
          ) : (
            <>
              <div className="mb-3 space-y-1.5">
                {roster.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-xl bg-cream-card px-2.5 py-2 dark:bg-white/5">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-espresso dark:text-cream">
                      {s.firstName} {s.lastName}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      {STATUS_BUTTONS.map((btn) => {
                        const Icon = btn.icon;
                        const active = statuses[s.id] === btn.id;
                        return (
                          <button
                            key={btn.id}
                            onClick={() => setStatuses((prev) => ({ ...prev, [s.id]: btn.id }))}
                            title={ATTENDANCE_LABEL[btn.id]}
                            aria-label={ATTENDANCE_LABEL[btn.id]}
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-lg text-[10px] font-semibold transition active:scale-95",
                              active ? STATUS_STYLES[btn.id] : cn(STATUS_STYLES.unmarked, "opacity-60 hover:opacity-100")
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={save}
                disabled={saving || unmarked > 0}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Kaydediliyor..." : unmarked > 0 ? `${unmarked} öğrenci işaretlenmedi` : "Yoklamayı Kaydet"}
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}

export function MissedAttendanceTab() {
  const { showError } = useToast();
  const [lessons, setLessons] = useState<MissedLesson[] | null>(null);
  const [lookback, setLookback] = useState(14);

  const load = useCallback(() => {
    fetch("/api/teacher/missed-attendance")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setLessons(d.lessons ?? []);
        if (d.lookbackDays) setLookback(d.lookbackDays);
      })
      .catch(() => showError("Unutulan yoklamalar yüklenemedi."));
  }, [showError]);

  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold uppercase tracking-tight text-espresso dark:text-cream">Unutulan Yoklamalar</h1>
        <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/45">
          Son {lookback} günde girdiğiniz ama yoklaması alınmamış dersler. Bugünün dersleri burada YOKTUR — onları Canlı
          Yoklama&apos;dan girersiniz.
        </p>
      </div>

      {lessons === null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : lessons.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-white p-8 text-center dark:border-white/10 dark:bg-midnight-card/50">
          <CheckCheck className="mx-auto mb-2 h-7 w-7 text-green-600" />
          <p className="text-sm font-semibold text-espresso dark:text-cream">Eksik yoklamanız yok</p>
          <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/45">Son {lookback} günün tamamı girilmiş.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <Users className="h-3.5 w-3.5 shrink-0" />
            {lessons.length} derste yoklama eksik — en yeniden başlayarak kapatabilirsiniz.
          </div>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {lessons.map((lesson) => (
                <MissedLessonCard
                  key={lessonKey(lesson)}
                  lesson={lesson}
                  onDone={() => setLessons((prev) => (prev ?? []).filter((l) => lessonKey(l) !== lessonKey(lesson)))}
                />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
