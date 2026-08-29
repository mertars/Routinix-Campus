"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Loader2, CheckCheck, Users, History, Radio, AlertTriangle, CalendarSearch, Lock, BookOpen } from "lucide-react";
import { type AttendanceStatus, ATTENDANCE_STATUS_LABEL } from "@/lib/mock-data";
import { getTrDayNameForDate, parseSlotRange } from "@/lib/schedule-time";
import { Modal } from "@/components/ui/modal";
import { AvatarInitials } from "@/components/principal/avatar-initials";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-green-600 text-white",
  absent: "bg-rose-600 text-white",
  late: "bg-brand-600 text-white",
  unmarked: "bg-white text-espresso-muted dark:bg-white/5 dark:text-cream/40",
};

const DB_TO_LOWER: Record<string, AttendanceStatus> = { PRESENT: "present", ABSENT: "absent", LATE: "late" };

type Branch = { id: string; name: string };
type LessonOption = { day: string; slot: string; subject: string; teacherName: string };
type Submission = { id: string; date: string; recordCount: number; createdAt: string; teacherName: string; branchName: string };
type AttendanceRow = { studentId: string; studentName: string; branch: string; status: AttendanceStatus; dailyAbsenceCount: number; lessonAbsenceCount: number };
type HistoryRecord = { date: string; slot: string; subject: string; status: string };
type HistoryData = {
  student: { firstName: string; lastName: string; branchName: string };
  summary: { dailyAbsenceCount: number; lessonAbsenceCount: number };
  records: HistoryRecord[];
};

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type NotifyState = "idle" | "sending" | "sent" | "no-recipient" | "failed";

// Veliye GERÇEK bir SMS/bildirim gönderir — /api/notifications/send zaten var
// olan toplu bildirim altyapısını CUSTOM_ID_LIST kapsamıyla (tek öğrenci)
// kullanır. Bu, "salt okunur" kısıtlamasının KAPSAMI DIŞINDA: yoklama
// DURUMUNU değiştirmiyor, sadece zaten kaydedilmiş bir devamsızlık/geç kalma
// hakkında veliyi bilgilendiriyor.
function NotifyButton({ row }: { row: AttendanceRow }) {
  const [state, setState] = useState<NotifyState>("idle");

  async function handleNotify() {
    setState("sending");
    try {
      const durum = row.status === "absent" ? "bugün okula gelmedi" : "bugün derse geç kaldı";
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeType: "CUSTOM_ID_LIST",
          scopeValue: row.studentId,
          templateBody: "Sayın {veli_adi}, öğrenciniz {ogrenci_adi} {durum}.",
          extraParams: { durum },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data?.error === "string" && data.error.includes("SMS onayı")) {
          setState("no-recipient");
          return;
        }
        throw new Error(data?.error ?? "Gönderilemedi.");
      }
      setState(data.recipientCount > 0 ? "sent" : "no-recipient");
    } catch {
      setState("failed");
    }
  }

  if (state === "no-recipient") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
        <AlertTriangle className="h-3 w-3" /> Veli SMS onayı yok
      </span>
    );
  }
  if (state === "failed") {
    return (
      <button
        onClick={handleNotify}
        className="flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-medium text-rose-700 transition hover:bg-rose-200 dark:bg-rose-500/15 dark:text-rose-300"
      >
        <AlertTriangle className="h-3 w-3" /> Gönderilemedi, tekrar dene
      </button>
    );
  }

  return (
    <motion.button
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={handleNotify}
      disabled={state !== "idle"}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-default",
        state === "sent"
          ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
          : "bg-espresso text-cream hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
      )}
    >
      {state === "idle" && (
        <>
          <Bell className="h-3 w-3" /> SMS Gönder
        </>
      )}
      {state === "sending" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" /> Gönderiliyor...
        </>
      )}
      {state === "sent" && (
        <>
          <CheckCheck className="h-3 w-3" /> Veliye Ulaştı
        </>
      )}
    </motion.button>
  );
}

// Kampüs V2 Part 4 — Yönetici Yoklama Matrisi artık SALT OKUNUR: ekran boş
// açılır, yönetici bir Şube + Tarih seçer, o gün için programda olan
// dersler listelenir, bir derse tıklanınca o dersin yoklaması (değiştirilemez)
// görünür. Durumu SADECE dersi işleyen öğretmen değiştirebilir (bkz. POST
// /api/attendance) — bu ekranda artık HİÇBİR "Geldi/Geç/Yok" butonu yok.
export function AttendanceCommandTab() {
  const { showError } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [lessonSlots, setLessonSlots] = useState<LessonOption[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<LessonOption | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [historyStudentId, setHistoryStudentId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/branches")
      .then((res) => res.json())
      .then((data) => setBranches(data.branches ?? []))
      .catch(() => showError("Şube listesi yüklenemedi."));
    fetch("/api/admin/attendance-submissions")
      .then((res) => res.json())
      .then((data) => setSubmissions(data.submissions ?? []))
      .catch(() => {
        // sessiz — akış boş görünür
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dayName = useMemo(() => (selectedDate ? getTrDayNameForDate(new Date(selectedDate)) : null), [selectedDate]);

  // Şube + Tarih İKİSİ de seçilmeden hiçbir şey yüklenmez — ekranın
  // "tamamen boş" açılması gerekliliği (Part 4) buradan gelir.
  const versionRef = useRef(0);
  useEffect(() => {
    setSelectedLesson(null);
    setRows([]);
    if (!selectedBranchId || !selectedDate) {
      setLessonSlots([]);
      return;
    }
    const myVersion = ++versionRef.current;
    setLessonsLoading(true);
    fetch(`/api/lesson-slots?branchId=${encodeURIComponent(selectedBranchId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (versionRef.current !== myVersion) return;
        const all: { day: string; slot: string; subject: string; teacherName: string }[] = data.slots ?? [];
        const todays = all
          .filter((s) => s.day === dayName)
          .sort((a, b) => parseSlotRange(a.slot)[0] - parseSlotRange(b.slot)[0]);
        setLessonSlots(todays);
      })
      .catch(() => {
        if (versionRef.current === myVersion) showError("Ders programı yüklenemedi.");
      })
      .finally(() => {
        if (versionRef.current === myVersion) setLessonsLoading(false);
      });
  }, [selectedBranchId, selectedDate, dayName, showError]);

  function openLesson(lesson: LessonOption) {
    setSelectedLesson(lesson);
    setRowsLoading(true);
    const params = new URLSearchParams({ branchId: selectedBranchId, date: selectedDate, slot: lesson.slot });
    fetch(`/api/admin/attendance?${params}`)
      .then((res) => res.json())
      .then((data) => setRows(data.rows ?? []))
      .catch(() => showError("Yoklama verisi yüklenemedi."))
      .finally(() => setRowsLoading(false));
  }

  function openHistory(studentId: string) {
    setHistoryStudentId(studentId);
    setHistoryLoading(true);
    fetch(`/api/admin/attendance-history?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => res.json())
      .then((data) => setHistoryData(data))
      .catch(() => showError("Devamsızlık geçmişi yüklenemedi."))
      .finally(() => setHistoryLoading(false));
  }

  const counts = {
    present: rows.filter((row) => row.status === "present").length,
    late: rows.filter((row) => row.status === "late").length,
    absent: rows.filter((row) => row.status === "absent").length,
    unmarked: rows.filter((row) => row.status === "unmarked").length,
  };

  const dateLabel = selectedDate
    ? new Date(selectedDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })
    : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedBranchId}
          onChange={(event) => setSelectedBranchId(event.target.value)}
          className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        >
          <option value="">Şube Seç</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={selectedDate}
          max={todayIsoDate()}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        />
        <span className="flex items-center gap-1.5 rounded-full bg-cream-card px-3 py-1.5 text-[11px] font-medium text-espresso-muted dark:bg-white/5 dark:text-cream/40">
          <Lock className="h-3 w-3" /> Salt okunur — durumu sadece dersi işleyen öğretmen değiştirebilir
        </span>
      </div>

      {!selectedBranchId || !selectedDate ? (
        <div className="rounded-3xl border border-dashed border-hairline bg-white/50 p-10 text-center dark:border-white/10 dark:bg-midnight-card/30">
          <CalendarSearch className="mx-auto mb-2 h-6 w-6 text-espresso-muted dark:text-cream/30" />
          <p className="text-sm text-espresso-muted dark:text-cream/40">Görüntülemek için önce bir şube ve tarih seçin.</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50"
        >
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <BookOpen className="h-4 w-4 text-brand-600" /> {dateLabel} — {dayName ?? "Hafta sonu"} Dersleri
          </h2>
          {lessonsLoading && <p className="text-xs text-espresso-muted dark:text-cream/40">Yükleniyor...</p>}
          {!lessonsLoading && lessonSlots.length === 0 && (
            <p className="text-xs text-espresso-muted dark:text-cream/40">
              {dayName ? "Bu şube için bu gün programda ders görünmüyor." : "Hafta sonu için ders programı yok."}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {lessonSlots.map((lesson) => {
              const isActive = selectedLesson?.slot === lesson.slot;
              return (
                <button
                  key={lesson.slot}
                  onClick={() => openLesson(lesson)}
                  className={cn(
                    "rounded-xl border px-3.5 py-2.5 text-left text-xs transition",
                    isActive
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-hairline bg-cream-card text-espresso hover:border-brand-500/40 dark:border-white/10 dark:bg-white/5 dark:text-cream"
                  )}
                >
                  <p className="font-semibold">{lesson.slot}</p>
                  <p className={cn("text-[10px]", isActive ? "text-white/70" : "text-espresso-muted dark:text-cream/40")}>
                    {lesson.subject} · {lesson.teacherName}
                  </p>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {selectedLesson && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-hairline bg-white/70 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
              <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{counts.present}</p>
              <p className="text-[11px] text-espresso-muted dark:text-cream/40">Geldi</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white/70 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
              <p className="text-2xl font-semibold text-brand-600">{counts.late}</p>
              <p className="text-[11px] text-espresso-muted dark:text-cream/40">Geç Kaldı</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white/70 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
              <p className="text-2xl font-semibold text-rose-600 dark:text-rose-400">{counts.absent}</p>
              <p className="text-[11px] text-espresso-muted dark:text-cream/40">Gelmedi</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white/70 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
              <p className="text-2xl font-semibold text-espresso dark:text-cream">{counts.unmarked}</p>
              <p className="text-[11px] text-espresso-muted dark:text-cream/40">İşaretlenmedi</p>
            </div>
          </div>

          <motion.div
            whileHover={{ scale: 1.005, y: -2 }}
            className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
          >
            <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
              <Users className="h-4 w-4 text-brand-600" /> {selectedLesson.slot} · {selectedLesson.subject} — Yoklama (Salt Okunur)
            </h2>
            {rowsLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-espresso-muted dark:text-cream/40" />
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((row, index) => (
                  <motion.div
                    key={row.studentId}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
                  >
                    <button onClick={() => openHistory(row.studentId)} className="group flex min-w-[140px] items-center gap-2 text-left">
                      <AvatarInitials name={row.studentName} className="h-8 w-8 shrink-0 text-xs" />
                      <div>
                        <p className="flex items-center gap-1 text-sm font-medium text-espresso group-hover:text-brand-600 dark:text-cream dark:group-hover:text-brand-400">
                          {row.studentName} <History className="h-3 w-3 opacity-0 transition group-hover:opacity-60" />
                        </p>
                        <p className="text-[11px] text-espresso-muted dark:text-cream/40">
                          Günlük: {row.dailyAbsenceCount} · Ders: {row.lessonAbsenceCount}
                        </p>
                      </div>
                    </button>

                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", STATUS_STYLES[row.status])}>
                      {ATTENDANCE_STATUS_LABEL[row.status]}
                    </span>

                    <div className="flex min-w-[130px] justify-end">
                      {(row.status === "absent" || row.status === "late") && <NotifyButton key={row.studentId + row.status} row={row} />}
                    </div>
                  </motion.div>
                ))}
                {rows.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Kayıtlı öğrenci bulunamadı.</p>}
              </div>
            )}
          </motion.div>
        </>
      )}

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Radio className="h-4 w-4 text-brand-600" /> Son Yoklama Gönderimleri
        </h2>
        <div className="space-y-2">
          {submissions.map((s, index) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02 }}
              className="flex items-center justify-between gap-3 rounded-xl bg-cream-card px-3 py-2.5 text-xs dark:bg-white/5"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-espresso dark:text-cream">
                  {s.teacherName} · {s.branchName}
                </p>
                <p className="text-espresso-muted dark:text-cream/40">
                  {new Date(s.date).toLocaleDateString("tr-TR")} tarihi için {s.recordCount} öğrenci
                </p>
              </div>
              <span className="shrink-0 text-[10px] text-espresso-muted dark:text-cream/30">
                {new Date(s.createdAt).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            </motion.div>
          ))}
          {submissions.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz gönderilmiş bir yoklama yok.</p>}
        </div>
      </motion.div>

      <Modal isOpen={!!historyStudentId} onClose={() => setHistoryStudentId(null)} title="Devamsızlık Geçmişi">
        {historyLoading || !historyData ? (
          <div className="flex items-center justify-center py-10 text-espresso-muted dark:text-cream/40">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-espresso dark:text-cream">
                {historyData.student.firstName} {historyData.student.lastName}
              </p>
              <p className="text-xs text-espresso-muted dark:text-cream/40">{historyData.student.branchName}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-rose-50 p-3 text-center dark:bg-rose-500/10">
                <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{historyData.summary.dailyAbsenceCount}</p>
                <p className="text-[10px] text-espresso-muted dark:text-cream/40">Günlük Devamsızlık</p>
              </div>
              <div className="rounded-xl bg-brand-50 p-3 text-center dark:bg-brand-600/10">
                <p className="text-xl font-bold text-brand-600">{historyData.summary.lessonAbsenceCount}</p>
                <p className="text-[10px] text-espresso-muted dark:text-cream/40">Ders Devamsızlığı</p>
              </div>
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              <AnimatePresence>
                {historyData.records.map((r, index) => {
                  const lower = DB_TO_LOWER[r.status] ?? "unmarked";
                  return (
                    <motion.div
                      key={`${r.date}-${r.slot}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.015 }}
                      className="flex items-center justify-between rounded-lg bg-cream-card px-3 py-1.5 text-xs dark:bg-white/5"
                    >
                      <span className="text-espresso dark:text-cream">
                        {new Date(r.date).toLocaleDateString("tr-TR")} · {r.slot} · {r.subject}
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_STYLES[lower])}>{ATTENDANCE_STATUS_LABEL[lower]}</span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {historyData.records.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Kayıtlı devamsızlık geçmişi yok.</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
