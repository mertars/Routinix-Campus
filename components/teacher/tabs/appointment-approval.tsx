"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Clock, CalendarCheck, Table2, Ban, Loader2 } from "lucide-react";
import { SCHEDULE_DAYS, SCHEDULE_SLOTS, type ScheduleDay, type ScheduleSlot } from "@/lib/mock-data";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { WeeklyGrid, type WeeklyGridCell } from "@/components/teacher/weekly-grid";
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

const STATUS_BADGE: Record<AppointmentStatus, string> = {
  PENDING: "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

export function AppointmentApprovalTab() {
  const { staffRecord } = useTeacherScope();
  const { showError, showSuccess } = useToast();
  const [requests, setRequests] = useState<AppointmentEntry[]>([]);
  const [blocks, setBlocks] = useState<Set<string>>(new Set());
  const [decidingId, setDecidingId] = useState<string | null>(null);

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

  async function loadBlocks() {
    try {
      const res = await fetch(`/api/teacher-availability?teacherId=${encodeURIComponent(staffRecord.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setBlocks(new Set((data.blocks ?? []).map((b: { day: string; slot: string }) => `${b.day}__${b.slot}`)));
    } catch {
      showError("Müsaitlik bilgisi yüklenemedi.");
    }
  }

  useEffect(() => {
    loadRequests();
    loadBlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffRecord.id]);

  async function updateStatus(id: string, status: "APPROVED" | "REJECTED") {
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
      if (status === "APPROVED") showSuccess("Randevu onaylandı, haftalık çizelgeye işlendi.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Karar kaydedilemedi.");
    } finally {
      setDecidingId(null);
    }
  }

  async function toggleBlock(day: ScheduleDay, slot: ScheduleSlot) {
    const key = `${day}__${slot}`;
    const nextUnavailable = !blocks.has(key);
    setBlocks((prev) => {
      const next = new Set(prev);
      if (nextUnavailable) next.add(key);
      else next.delete(key);
      return next;
    });
    try {
      await fetch("/api/teacher-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: staffRecord.id, day, slot, unavailable: nextUnavailable }),
      });
    } catch {
      showError("Müsaitlik güncellenemedi.");
    }
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const resolved = requests.filter((r) => r.status !== "PENDING");
  const approved = requests.filter((r) => r.status === "APPROVED");

  function getCell(day: ScheduleDay, slot: ScheduleSlot): WeeklyGridCell {
    const row = approved.find((item) => item.day === day && item.slot === slot);
    if (row) return { label: `${row.student.firstName} ${row.student.lastName}`, tone: "border-green-500/40 bg-green-50 dark:border-green-500/20 dark:bg-green-500/10" };
    if (blocks.has(`${day}__${slot}`)) return { label: "Bloke", tone: "border-hairline bg-cream-card text-espresso-muted/50 dark:border-white/10 dark:bg-white/5" };
    return null;
  }

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
              <motion.div
                key={request.id}
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
                    onClick={() => updateStatus(request.id, "APPROVED")}
                    disabled={decidingId === request.id}
                    className="flex min-h-[40px] items-center justify-center gap-1 rounded-full bg-green-600 text-[11px] font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
                  >
                    {decidingId === request.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Onayla
                  </button>
                  <button
                    onClick={() => updateStatus(request.id, "REJECTED")}
                    disabled={decidingId === request.id}
                    className="flex min-h-[40px] items-center justify-center gap-1 rounded-full bg-rose-100 text-[11px] font-medium text-rose-700 transition hover:bg-rose-200 disabled:opacity-60 dark:bg-rose-500/15 dark:text-rose-300"
                  >
                    <X className="h-3 w-3" /> Reddet
                  </button>
                </div>
              </motion.div>
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
          <Ban className="h-4 w-4 text-brand-600" /> Müsait Olmadığım Saatler
        </h2>
        <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">
          Etüt alamayacağınız saatleri işaretleyin — öğrenciler bu saatlere randevu talep edemez.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SCHEDULE_DAYS.flatMap((day) =>
            SCHEDULE_SLOTS.map((slot) => {
              const key = `${day}__${slot}`;
              const isBlocked = blocks.has(key);
              const isBooked = approved.some((r) => r.day === day && r.slot === slot);
              return (
                <button
                  key={key}
                  onClick={() => !isBooked && toggleBlock(day, slot)}
                  disabled={isBooked}
                  className={cn(
                    "flex min-h-[52px] flex-col items-center justify-center rounded-xl text-center text-[10px] font-medium transition disabled:opacity-50",
                    isBooked
                      ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                      : isBlocked
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                        : "bg-cream-card text-espresso-muted hover:bg-brand-50 dark:bg-white/5 dark:text-cream/40"
                  )}
                >
                  <span>{day.slice(0, 3)}</span>
                  <span>{slot}</span>
                </button>
              );
            })
          )}
        </div>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Table2 className="h-4 w-4 text-brand-600" /> Haftalık Etüt Çizelgesi
        </h2>
        <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">
          Onayladığınız etütler otomatik olarak &quot;Haftalık Program&quot; sekmenize de işlenir.
        </p>
        <WeeklyGrid getCell={getCell} />
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
