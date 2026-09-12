"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Clock, Bell, Loader2, CheckCheck, Radio, Archive, BarChart2, Send, CheckCircle2, FileText, AlertTriangle, RotateCcw } from "lucide-react";
import { useTeacherScope, useCurrentLesson } from "@/lib/teacher-scope";
import { getTodayTrDayName, parseSlotRange } from "@/lib/schedule-time";
import { useToast } from "@/lib/toast-context";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

import { ATTENDANCE_LABEL, type AttendanceStatus } from "@/lib/attendance/status";
type RosterStudent = { id: string; firstName: string; lastName: string };
type ArchiveEntry = { id: string; teacherName: string; branchName: string; date: string; submittedAt: string; records: { studentName: string; status: AttendanceStatus }[] };

// Sıra bilinçli: en sık kullanılan solda. "İzinli", "Yok"tan ÖNCE —
// mazeretli öğrenciyi yanlışlıkla devamsız işaretlemek, tersinden daha
// sık yapılan bir hata.
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type NotifyState = "idle" | "sending" | "sent" | "no-recipient" | "failed";

// ⚠️ Bu düğme eskiden SAHTEYDİ: hiçbir istek atmıyor, 1 saniye bekleyip
// "Ulaştı" gösteriyordu — öğretmen veliye gerçekten haber verildiğini
// sanıyor, kimseye bir şey gitmiyordu. Yönetici tarafındaki AYNI düğmeyle
// (attendance-command.tsx) birebir aynı davranışa getirildi: gerçek istek,
// gerçek "SMS izni yok" ve "gönderilemedi" durumları.
function NotifyButton({ studentId, status }: { studentId: string; status: "ABSENT" | "LATE" }) {
  const [state, setState] = useState<NotifyState>("idle");

  async function handleNotify() {
    setState("sending");
    try {
      const res = await fetch("/api/teacher/notify-absence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, status }),
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
        <RotateCcw className="h-3 w-3" /> Tekrar dene
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
          <Bell className="h-3 w-3" /> Veliye Bildir
        </>
      )}
      {state === "sending" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" /> Gönderiliyor...
        </>
      )}
      {state === "sent" && (
        <>
          <CheckCheck className="h-3 w-3" /> Ulaştı
        </>
      )}
    </motion.button>
  );
}

function ArchiveModal({ isOpen, onClose, entries }: { isOpen: boolean; onClose: () => void; entries: ArchiveEntry[] }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Geçmiş Yoklama Arşivi" variant="center">
      <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">Salt okunur — geçmiş kayıtlar değiştirilemez.</p>
      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-medium text-espresso dark:text-cream">{entry.branchName}</p>
              <span className="text-[10px] text-espresso-muted dark:text-cream/40">{entry.date}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {entry.records.map((record) => (
                <span key={record.studentName} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_STYLES[record.status])}>
                  {record.studentName}
                </span>
              ))}
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Arşivde kayıt yok.</p>}
      </div>
    </Modal>
  );
}

function AbsenceAnalysisModal({ isOpen, onClose, entries, roster }: { isOpen: boolean; onClose: () => void; entries: ArchiveEntry[]; roster: RosterStudent[] }) {
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    if (isOpen && !studentName && roster.length > 0) setStudentName(`${roster[0].firstName} ${roster[0].lastName}`);
  }, [isOpen, roster, studentName]);

  const entryRows = entries
    .flatMap((row) => row.records.map((record) => ({ ...record, date: `${row.branchName} · ${row.date}` })))
    .filter((record) => record.studentName === studentName);

  const absentCount = entryRows.filter((e) => e.status === "ABSENT").length;
  const lateCount = entryRows.filter((e) => e.status === "LATE").length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Öğrenci Devamsızlık Analizi" variant="center">
      <select
        value={studentName}
        onChange={(event) => setStudentName(event.target.value)}
        className="mb-3 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
      >
        {roster.map((student) => (
          <option key={student.id} value={`${student.firstName} ${student.lastName}`}>
            {student.firstName} {student.lastName}
          </option>
        ))}
      </select>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-rose-50 p-3 text-center dark:bg-rose-500/10">
          <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{absentCount}</p>
          <p className="text-[10px] text-espresso-muted dark:text-cream/40">Toplam Devamsızlık</p>
        </div>
        <div className="rounded-xl bg-brand-50 p-3 text-center dark:bg-brand-600/10">
          <p className="text-xl font-bold text-brand-600">{lateCount}</p>
          <p className="text-[10px] text-espresso-muted dark:text-cream/40">Geç Kalma</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {entryRows.map((entry, index) => (
          <div key={index} className="flex items-center justify-between rounded-lg bg-cream-card px-3 py-1.5 text-xs dark:bg-white/5">
            <span className="text-espresso dark:text-cream">{entry.date}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_STYLES[entry.status])}>
              {ATTENDANCE_LABEL[entry.status] ?? entry.status}
            </span>
          </div>
        ))}
        {entryRows.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Bu öğrenci için kayıt yok.</p>}
      </div>
    </Modal>
  );
}

export function LiveAttendanceTab() {
  const { teacherName, staffRecord, assignedBranches, mySchedule } = useTeacherScope();
  const lesson = useCurrentLesson(mySchedule);
  const { showError, showSuccess } = useToast();
  const suggestedBranchId = assignedBranches.find((b) => b.name === lesson.branchName)?.id ?? assignedBranches[0]?.id ?? "";
  const [selectedBranchId, setSelectedBranchId] = useState("");
  useEffect(() => {
    setSelectedBranchId((current) => current || suggestedBranchId);
  }, [suggestedBranchId]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus | "unmarked">>({});
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [archiveEntries, setArchiveEntries] = useState<ArchiveEntry[]>([]);

  const branch = assignedBranches.find((b) => b.id === selectedBranchId);

  // Part 4 — yoklama artık bir GÜNÜ değil bir DERSİ hedefler (bkz.
  // AttendanceRecord şema notu): öğretmen aynı gün aynı şubede birden fazla
  // ders saatine sahip olabilir (örn. Pazartesi 16:00 ve Perşembe 16:00 AYNI
  // gün değil ama iki farklı şubede aynı gün iki ders olabilir), bu yüzden
  // hangi ders saati için yoklama girildiğini AÇIKÇA seçtiriyoruz — mySchedule
  // (öğretmenin TÜM haftalık programı, zaten yüklü) bugünün gün adına ve
  // seçili şubeye göre süzülüyor, ayrı bir istek gerekmiyor.
  const todayDayName = getTodayTrDayName();
  const todaysLessonsForBranch = useMemo(
    () =>
      mySchedule
        .filter((row) => row.day === todayDayName && row.branchId === selectedBranchId)
        .sort((a, b) => parseSlotRange(a.slot)[0] - parseSlotRange(b.slot)[0]),
    [mySchedule, todayDayName, selectedBranchId]
  );
  const [selectedSlot, setSelectedSlot] = useState("");
  useEffect(() => {
    setSelectedSlot((current) => {
      if (todaysLessonsForBranch.some((row) => row.slot === current)) return current;
      const live = todaysLessonsForBranch.find((row) => row.slot === lesson.slot);
      return live?.slot ?? todaysLessonsForBranch[0]?.slot ?? "";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todaysLessonsForBranch]);

  useEffect(() => {
    if (!selectedBranchId) return;
    let cancelled = false;
    setRoster([]);
    (async () => {
      try {
        const res = await fetch(`/api/students?branchId=${encodeURIComponent(selectedBranchId)}`);
        const data = await res.json();
        if (!cancelled) setRoster(data.students ?? []);
      } catch {
        if (!cancelled) showError("Sınıf listesi yüklenemedi, veritabanı bağlantısını kontrol edin.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBranchId, showError]);

  useEffect(() => {
    setStatuses({});
    if (!selectedBranchId || !selectedSlot) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/attendance?branchId=${encodeURIComponent(selectedBranchId)}&date=${todayIso()}&slot=${encodeURIComponent(selectedSlot)}`
        );
        const data = await res.json();
        if (cancelled) return;
        const prefill: Record<string, AttendanceStatus> = {};
        for (const record of data.records ?? []) prefill[record.studentId] = record.status;
        setStatuses(prefill);
      } catch {
        // sessiz — boş (unmarked) durumla devam edilir
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBranchId, selectedSlot]);

  // İşaretlenmemiş öğrenci sayısı — kaydet düğmesinin kilidi buna bağlı.
  const unmarkedCount = roster.filter((st) => !statuses[st.id] || statuses[st.id] === "unmarked").length;

  function markAll(status: AttendanceStatus) {
    return () => setStatuses(Object.fromEntries(roster.map((st) => [st.id, status])));
  }

  // Yalnızca BOŞ olanları doldurur — öğretmenin elle işaretlediği
  // devamsızlıkları ezmez.
  function markRemaining(status: AttendanceStatus) {
    return () =>
      setStatuses((prev) => {
        const next = { ...prev };
        for (const st of roster) if (!next[st.id] || next[st.id] === "unmarked") next[st.id] = status;
        return next;
      });
  }

  function setStatus(studentId: string, status: AttendanceStatus) {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  }

  async function loadArchive() {
    try {
      const res = await fetch(`/api/attendance/archive?teacherId=${encodeURIComponent(staffRecord.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Arşiv yüklenemedi.");
      setArchiveEntries(data.entries ?? []);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Arşiv yüklenemedi.");
    }
  }

  async function handleSubmit() {
    if (!branch || !selectedSlot || roster.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: staffRecord.id,
          branchId: branch.id,
          date: todayIso(),
          slot: selectedSlot,
          // ⚠️ Eskiden işaretlenmeyen öğrenci sessizce "PRESENT"
          // sayılıyordu; ekranda bunu söyleyen hiçbir şey yoktu, yani
          // öğretmen farkında olmadan boş gönderince tüm devamsızlıklar
          // "geldi" olarak kaydoluyordu. Artık eksik işaretleme varken
          // kaydet düğmesi zaten kilitli (bkz. allMarked).
          records: roster.map((student) => ({ studentId: student.id, status: statuses[student.id] as AttendanceStatus })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Yoklama kaydedilemedi.");
      setSubmitted(true);
      showSuccess("Yoklama yönetici paneline iletildi.");
      setTimeout(() => setSubmitted(false), 2200);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Yoklama kaydedilemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {lesson.isLive && lesson.branchName === branch?.name && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-4 py-2.5 text-xs font-medium text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"
        >
          <Radio className="h-4 w-4 animate-pulse" /> Şu an {branch.name} {lesson.subject} dersindesiniz — sınıf otomatik seçildi.
        </motion.div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
            className="min-h-[44px] rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            {assignedBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {todaysLessonsForBranch.length > 0 ? (
            <select
              value={selectedSlot}
              onChange={(event) => setSelectedSlot(event.target.value)}
              className="min-h-[44px] rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            >
              {todaysLessonsForBranch.map((row) => (
                <option key={row.slot} value={row.slot}>
                  {row.slot} · {row.subject}
                </option>
              ))}
            </select>
          ) : (
            <span className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
              Bugün bu şube için programda dersin görünmüyor
            </span>
          )}
          <span className="text-xs text-espresso-muted dark:text-cream/40">{roster.length} öğrenci</span>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-wrap">
          <button
            onClick={() => {
              setIsArchiveOpen(true);
              loadArchive();
            }}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
          >
            <Archive className="h-3.5 w-3.5" /> Arşiv
          </button>
          <button
            onClick={() => {
              setIsAnalysisOpen(true);
              loadArchive();
            }}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
          >
            <BarChart2 className="h-3.5 w-3.5" /> Analiz
          </button>
        </div>
      </div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        {/* Tek tuşla hepsini işaretle: tipik derste 30 öğrencinin 28'i
            gelir. Önce "hepsi geldi" denir, sonra 2 kişi değiştirilir —
            30 dokunuş 3'e iner. Eksik işaretleme kaydı ENGELLEDİĞİ için
            bu kısayol olmadan kural yalnızca yük olurdu. */}
        {roster.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-hairline p-2.5 dark:border-white/10">
            <button
              onClick={markAll("PRESENT")}
              className="flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-green-500"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Hepsi Geldi
            </button>
            {unmarkedCount > 0 && (
              <button
                onClick={markRemaining("PRESENT")}
                className="rounded-full border border-hairline px-3 py-1.5 text-[11px] font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
              >
                Kalan {unmarkedCount} kişiyi &quot;Geldi&quot; yap
              </button>
            )}
            <span
              className={cn(
                "ml-auto flex items-center gap-1 text-[11px] font-medium",
                unmarkedCount > 0 ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400"
              )}
            >
              {unmarkedCount > 0 ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5" /> {unmarkedCount} eksik
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Tümü işaretlendi
                </>
              )}
            </span>
          </div>
        )}

        <div className="space-y-2">
          {roster.map((student, index) => {
            const status = statuses[student.id] ?? "unmarked";
            const studentName = `${student.firstName} ${student.lastName}`;
            return (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="rounded-2xl bg-cream-card p-3 dark:bg-white/5 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:rounded-xl sm:px-3 sm:py-2.5"
              >
                <p className="mb-2 text-sm font-medium text-espresso dark:text-cream sm:mb-0 sm:min-w-[140px]">{studentName}</p>
                <div className="grid grid-cols-4 gap-1.5 sm:flex sm:items-center">
                  {STATUS_BUTTONS.map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => setStatus(student.id, btn.id)}
                      className={cn(
                        "flex min-h-[40px] items-center justify-center gap-1 rounded-full text-[11px] font-medium transition sm:min-h-0 sm:px-2.5 sm:py-1",
                        STATUS_STYLES[btn.id],
                        status !== btn.id && "opacity-40 hover:opacity-100"
                      )}
                    >
                      <btn.icon className="h-3 w-3" /> {ATTENDANCE_LABEL[btn.id]}
                    </button>
                  ))}
                </div>
                {(status === "ABSENT" || status === "LATE") && (
                  <div className="mt-2 flex justify-start sm:mt-0 sm:min-w-[100px] sm:justify-end">
                    <NotifyButton key={student.id + status} studentId={student.id} status={status as "ABSENT" | "LATE"} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <button
          onClick={handleSubmit}
          disabled={roster.length === 0 || submitting || unmarkedCount > 0}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-espresso py-3 text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitted ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {submitting
            ? "Kaydediliyor..."
            : submitted
              ? "Yönetici Paneline İletildi"
              : unmarkedCount > 0
                ? `${unmarkedCount} öğrenci işaretlenmedi`
                : "Yoklamayı Kaydet ve Gönder"}
        </button>
      </motion.div>

      <ArchiveModal isOpen={isArchiveOpen} onClose={() => setIsArchiveOpen(false)} entries={archiveEntries} />
      <AbsenceAnalysisModal isOpen={isAnalysisOpen} onClose={() => setIsAnalysisOpen(false)} entries={archiveEntries} roster={roster} />
    </div>
  );
}
