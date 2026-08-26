"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Clock, Bell, Loader2, CheckCheck, Radio, Archive, BarChart2, Send, CheckCircle2 } from "lucide-react";
import { useTeacherScope, useCurrentLesson } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE";
type RosterStudent = { id: string; firstName: string; lastName: string };
type ArchiveEntry = { id: string; teacherName: string; branchName: string; date: string; submittedAt: string; records: { studentName: string; status: AttendanceStatus }[] };

const STATUS_STYLES: Record<AttendanceStatus | "unmarked", string> = {
  PRESENT: "bg-green-600 text-white",
  ABSENT: "bg-rose-600 text-white",
  LATE: "bg-brand-600 text-white",
  unmarked: "bg-white text-espresso-muted dark:bg-white/5 dark:text-cream/40",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function NotifyButton() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  return (
    <motion.button
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => {
        setState("sending");
        setTimeout(() => setState("sent"), 1000);
      }}
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
              {entry.status === "PRESENT" ? "Geldi" : entry.status === "LATE" ? "Geç" : "Yok"}
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
  const [selectedBranchId, setSelectedBranchId] = useState(suggestedBranchId);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus | "unmarked">>({});
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [archiveEntries, setArchiveEntries] = useState<ArchiveEntry[]>([]);

  const branch = assignedBranches.find((b) => b.id === selectedBranchId);

  useEffect(() => {
    if (!selectedBranchId) return;
    let cancelled = false;
    setRoster([]);
    setStatuses({});
    (async () => {
      try {
        const [studentsRes, marksRes] = await Promise.all([
          fetch(`/api/students?branchId=${encodeURIComponent(selectedBranchId)}`),
          fetch(`/api/attendance?branchId=${encodeURIComponent(selectedBranchId)}&date=${todayIso()}`),
        ]);
        const studentsData = await studentsRes.json();
        const marksData = await marksRes.json();
        if (cancelled) return;
        setRoster(studentsData.students ?? []);
        const prefill: Record<string, AttendanceStatus> = {};
        for (const record of marksData.records ?? []) prefill[record.studentId] = record.status;
        setStatuses(prefill);
      } catch {
        if (!cancelled) showError("Sınıf listesi yüklenemedi, veritabanı bağlantısını kontrol edin.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBranchId, showError]);

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
    if (!branch || roster.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: staffRecord.id,
          branchId: branch.id,
          date: todayIso(),
          records: roster.map((student) => ({ studentId: student.id, status: statuses[student.id] ?? "PRESENT" })),
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
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
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
                <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center">
                  <button
                    onClick={() => setStatus(student.id, "PRESENT")}
                    className={cn("flex min-h-[40px] items-center justify-center gap-1 rounded-full text-[11px] font-medium transition sm:min-h-0 sm:px-2.5 sm:py-1", STATUS_STYLES.PRESENT, status !== "PRESENT" && "opacity-40 hover:opacity-100")}
                  >
                    <Check className="h-3 w-3" /> Geldi
                  </button>
                  <button
                    onClick={() => setStatus(student.id, "LATE")}
                    className={cn("flex min-h-[40px] items-center justify-center gap-1 rounded-full text-[11px] font-medium transition sm:min-h-0 sm:px-2.5 sm:py-1", STATUS_STYLES.LATE, status !== "LATE" && "opacity-40 hover:opacity-100")}
                  >
                    <Clock className="h-3 w-3" /> Geç
                  </button>
                  <button
                    onClick={() => setStatus(student.id, "ABSENT")}
                    className={cn("flex min-h-[40px] items-center justify-center gap-1 rounded-full text-[11px] font-medium transition sm:min-h-0 sm:px-2.5 sm:py-1", STATUS_STYLES.ABSENT, status !== "ABSENT" && "opacity-40 hover:opacity-100")}
                  >
                    <X className="h-3 w-3" /> Yok
                  </button>
                </div>
                {(status === "ABSENT" || status === "LATE") && (
                  <div className="mt-2 flex justify-start sm:mt-0 sm:min-w-[100px] sm:justify-end">
                    <NotifyButton key={student.id + status} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <button
          onClick={handleSubmit}
          disabled={roster.length === 0 || submitting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-espresso py-3 text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitted ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {submitting ? "Kaydediliyor..." : submitted ? "Yönetici Paneline İletildi" : "Yoklamayı Kaydet ve Gönder"}
        </button>
      </motion.div>

      <ArchiveModal isOpen={isArchiveOpen} onClose={() => setIsArchiveOpen(false)} entries={archiveEntries} />
      <AbsenceAnalysisModal isOpen={isAnalysisOpen} onClose={() => setIsAnalysisOpen(false)} entries={archiveEntries} roster={roster} />
    </div>
  );
}
