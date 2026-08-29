"use client";

import { useCallback, useEffect, useMemo, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Clock, CalendarCheck, Coffee, Plus, Trash2, Loader2 } from "lucide-react";
import { SCHEDULE_DAYS, type ScheduleDay } from "@/lib/mock-data";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type AppointmentStatus = "PENDING" | "APPROVED" | "REJECTED";
type AppointmentEntry = {
  id: string;
  topic: string;
  day: string;
  slot: string;
  status: AppointmentStatus;
  student: { firstName: string; lastName: string };
};
type AvailabilityRange = { id: string; day: string; startTime: string; endTime: string };

const STATUS_BADGE: Record<AppointmentStatus, string> = {
  PENDING: "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

function AddRangeRow({ day, onAdd }: { day: ScheduleDay; onAdd: (start: string, end: string) => Promise<void> }) {
  const [start, setStart] = useState("15:00");
  const [end, setEnd] = useState("16:00");
  const [adding, setAdding] = useState(false);

  async function submit() {
    if (start >= end) return;
    setAdding(true);
    try {
      await onAdd(start, end);
      // eslint-disable-next-line no-empty
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="time"
        value={start}
        onChange={(event) => setStart(event.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
      />
      <span className="text-espresso-muted dark:text-cream/40">–</span>
      <input
        type="time"
        value={end}
        onChange={(event) => setEnd(event.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
      />
      <button
        onClick={submit}
        disabled={adding || start >= end}
        title={`${day} için aralık ekle`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-espresso text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// memo + kararlı (useCallback'li) onApprove/onReject sayesinde, ebeveynde
// mola süresi inputuna her tuş vuruşunda TÜM bekleyen talep kartları
// yeniden render edilmiyor — sadece gerçekten değişen kart.
const PendingRequestCard = memo(function PendingRequestCard({
  request,
  isDeciding,
  onApprove,
  onReject,
}: {
  request: AppointmentEntry;
  isDeciding: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="rounded-2xl bg-cream-card p-3 dark:bg-white/5"
    >
      <div className="mb-2">
        <p className="text-sm font-medium text-espresso dark:text-cream">{request.student.firstName} {request.student.lastName}</p>
        <p className="text-[11px] text-espresso-muted dark:text-cream/40">{request.topic} · {request.day} {request.slot}</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => onApprove(request.id)}
          disabled={isDeciding}
          className="flex min-h-[40px] items-center justify-center gap-1 rounded-full bg-green-600 text-[11px] font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
        >
          {isDeciding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Onayla
        </button>
        <button
          onClick={() => onReject(request.id)}
          disabled={isDeciding}
          className="flex min-h-[40px] items-center justify-center gap-1 rounded-full bg-rose-100 text-[11px] font-medium text-rose-700 transition hover:bg-rose-200 disabled:opacity-60 dark:bg-rose-500/15 dark:text-rose-300"
        >
          <X className="h-3 w-3" /> Reddet
        </button>
      </div>
    </motion.div>
  );
});

export function AppointmentApprovalTab() {
  const { staffRecord } = useTeacherScope();
  const { showError, showSuccess } = useToast();
  const [requests, setRequests] = useState<AppointmentEntry[]>([]);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const [ranges, setRanges] = useState<AvailabilityRange[]>([]);
  const [breakMinutes, setBreakMinutes] = useState("10");
  const [savingBreak, setSavingBreak] = useState(false);

  async function loadRequests() {
    try {
      const res = await fetch(`/api/appointments?teacherId=${encodeURIComponent(staffRecord.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setRequests(data.appointments ?? []);
    } catch {
      showError("Randevu talepleri yüklenemedi.");
    }
  }

  async function loadAvailability() {
    try {
      const res = await fetch(`/api/teacher-etut-availability?teacherId=${encodeURIComponent(staffRecord.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setRanges(data.ranges ?? []);
      setBreakMinutes(String(data.breakMinutes ?? 10));
    } catch {
      showError("Müsaitlik bilgisi yüklenemedi.");
    }
  }

  useEffect(() => {
    if (!staffRecord.id) return;
    loadRequests();
    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffRecord.id]);

  const updateStatus = useCallback(async (id: string, status: "APPROVED" | "REJECTED") => {
    setDecidingId(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Karar kaydedilemedi.");
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      if (status === "APPROVED") showSuccess("Randevu onaylandı, öğrenciye bildirilecek.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Karar kaydedilemedi.");
    } finally {
      setDecidingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showError, showSuccess]);
  const approveRequest = useCallback((id: string) => updateStatus(id, "APPROVED"), [updateStatus]);
  const rejectRequest = useCallback((id: string) => updateStatus(id, "REJECTED"), [updateStatus]);

  async function addRange(day: ScheduleDay, start: string, end: string) {
    try {
      const res = await fetch("/api/teacher-etut-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: staffRecord.id, day, startTime: start, endTime: end }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Aralık eklenemedi.");
      setRanges((prev) => [...prev, data.range]);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Aralık eklenemedi.");
    }
  }

  async function removeRange(id: string) {
    setRanges((prev) => prev.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/teacher-etut-availability/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      showError("Aralık silinemedi, sayfayı yenileyip tekrar deneyin.");
      loadAvailability();
    }
  }

  async function saveBreakMinutes() {
    setSavingBreak(true);
    try {
      const res = await fetch("/api/teacher-etut-availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: staffRecord.id, breakMinutes: Number(breakMinutes) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      showSuccess("Mola süresi güncellendi.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSavingBreak(false);
    }
  }

  const pending = useMemo(() => requests.filter((r) => r.status === "PENDING"), [requests]);
  const resolved = useMemo(() => requests.filter((r) => r.status !== "PENDING"), [requests]);
  const approved = useMemo(() => requests.filter((r) => r.status === "APPROVED"), [requests]);

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Clock className="h-4 w-4 text-brand-600" /> Onay Bekleyen Randevular ({pending.length})
        </h2>
        <div className="space-y-2">
          <AnimatePresence>
            {pending.map((request) => (
              <PendingRequestCard
                key={request.id}
                request={request}
                isDeciding={decidingId === request.id}
                onApprove={approveRequest}
                onReject={rejectRequest}
              />
            ))}
          </AnimatePresence>
          {pending.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Bekleyen randevu talebi yok.</p>}
        </div>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <CalendarCheck className="h-4 w-4 text-brand-600" /> Etüt Müsaitliğim
        </h2>
        <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">
          Her gün için birden fazla saat aralığı girebilirsin — sistem bunları kurum etüt süresine göre otomatik slotlara böler.
        </p>

        <div className="mb-4 flex items-end gap-2 rounded-2xl bg-cream-card p-3 dark:bg-white/5">
          <label className="flex-1">
            <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
              <Coffee className="h-3 w-3" /> Etütler Arası Mola (dk)
            </span>
            <input
              type="number"
              min={0}
              max={60}
              value={breakMinutes}
              onChange={(event) => setBreakMinutes(event.target.value)}
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </label>
          <button
            onClick={saveBreakMinutes}
            disabled={savingBreak}
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-espresso px-3 text-xs font-semibold text-cream transition hover:bg-caramel disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            {savingBreak ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Kaydet"}
          </button>
        </div>

        <div className="space-y-3">
          {SCHEDULE_DAYS.map((day) => {
            const dayRanges = ranges.filter((r) => r.day === day);
            return (
              <div key={day} className="rounded-2xl bg-cream-card p-3 dark:bg-white/5">
                <p className="mb-2 text-xs font-semibold text-espresso dark:text-cream">{day}</p>
                <div className="mb-2 space-y-1.5">
                  {dayRanges.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 dark:bg-midnight-card">
                      <span className="text-xs font-medium text-espresso dark:text-cream">{r.startTime} – {r.endTime}</span>
                      <button onClick={() => removeRange(r.id)} className="text-rose-500 transition hover:text-rose-600" aria-label="Aralığı sil">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {dayRanges.length === 0 && <p className="text-[11px] text-espresso-muted/70 dark:text-cream/30">Bu gün için aralık girilmedi.</p>}
                </div>
                <AddRangeRow day={day} onAdd={(start, end) => addRange(day, start, end)} />
              </div>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <CalendarCheck className="h-4 w-4 text-brand-600" /> Onaylanan Etütler ({approved.length})
        </h2>
        <div className="space-y-2">
          {approved.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-green-50 px-3 py-2.5 dark:bg-green-500/10">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-espresso dark:text-cream">{r.student.firstName} {r.student.lastName}</p>
                <p className="truncate text-[11px] text-espresso-muted dark:text-cream/40">{r.topic}</p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-green-700 dark:text-green-400">{r.day} · {r.slot}</span>
            </div>
          ))}
          {approved.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz onaylanmış etüt yok.</p>}
        </div>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <CalendarCheck className="h-4 w-4 text-brand-600" /> Karara Bağlananlar
        </h2>
        <div className="space-y-2">
          {resolved.map((request) => (
            <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
              <div>
                <p className="text-sm font-medium text-espresso dark:text-cream">{request.student.firstName} {request.student.lastName}</p>
                <p className="text-[11px] text-espresso-muted dark:text-cream/40">{request.topic} · {request.day} {request.slot}</p>
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_BADGE[request.status])}>
                {request.status === "APPROVED" ? "Onaylandı" : "Reddedildi"}
              </span>
            </div>
          ))}
          {resolved.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz karara bağlanan yok.</p>}
        </div>
      </motion.div>
    </div>
  );
}
