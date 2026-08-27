"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarCheck, Check, Clock, ChevronDown, Loader2 } from "lucide-react";
import { SCHEDULE_DAYS, SCHEDULE_SLOTS, type ScheduleDay, type ScheduleSlot } from "@/lib/mock-data";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type AppointmentStatus = "PENDING" | "APPROVED" | "REJECTED";
type AppointmentEntry = { id: string; topic: string; day: string; slot: string; status: AppointmentStatus; teacher: { firstName: string; lastName: string } };

const STATUS_BADGE: Record<AppointmentStatus, string> = {
  PENDING: "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: "Onay Bekliyor",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
};

type EligibleTeacher = { id: string; firstName: string; lastName: string; subject: string };

// Rehberlik branşındaki öğretmen (Zehra Rehber) Birebir Etüt'te değil, ayrı
// Rehberlik Görüşmesi modülünde (guidance.tsx) hedeflenir.
export function EtutTab() {
  const { studentId, branchId } = useStudentScope();
  const { showError, showSuccess } = useToast();

  const [eligibleTeachers, setEligibleTeachers] = useState<EligibleTeacher[]>([]);
  const [teacherId, setTeacherId] = useState("");

  useEffect(() => {
    if (!branchId) return;
    fetch(`/api/teachers?branchId=${encodeURIComponent(branchId)}&excludeSubject=${encodeURIComponent("Rehberlik")}`)
      .then((res) => res.json())
      .then((data) => {
        const teachers: EligibleTeacher[] = data.teachers ?? [];
        setEligibleTeachers(teachers);
        setTeacherId((current) => current || teachers[0]?.id || "");
      })
      .catch(() => showError("Öğretmen listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);
  const [expandedDay, setExpandedDay] = useState<ScheduleDay | null>(SCHEDULE_DAYS[0]);
  const [selectedSlot, setSelectedSlot] = useState<{ day: ScheduleDay; slot: ScheduleSlot } | null>(null);
  const [topic, setTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [blocks, setBlocks] = useState<Set<string>>(new Set());
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [myRequests, setMyRequests] = useState<AppointmentEntry[]>([]);

  async function loadAvailability() {
    if (!teacherId) return;
    try {
      const [availRes, apptRes] = await Promise.all([
        fetch(`/api/teacher-availability?teacherId=${encodeURIComponent(teacherId)}`),
        fetch(`/api/appointments?teacherId=${encodeURIComponent(teacherId)}`),
      ]);
      const availData = await availRes.json();
      const apptData = await apptRes.json();
      setBlocks(new Set((availData.blocks ?? []).map((b: { day: string; slot: string }) => `${b.day}__${b.slot}`)));
      setBooked(
        new Set(
          (apptData.appointments ?? [])
            .filter((a: { status: string }) => a.status === "APPROVED")
            .map((a: { day: string; slot: string }) => `${a.day}__${a.slot}`)
        )
      );
    } catch {
      showError("Müsaitlik bilgisi yüklenemedi.");
    }
  }

  async function loadMyRequests() {
    try {
      const res = await fetch(`/api/appointments?studentId=${encodeURIComponent(studentId)}`);
      const data = await res.json();
      setMyRequests(data.appointments ?? []);
    } catch {
      showError("Taleplerin yüklenemedi.");
    }
  }

  useEffect(() => {
    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  useEffect(() => {
    loadMyRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  function slotState(day: ScheduleDay, slot: ScheduleSlot) {
    const key = `${day}__${slot}`;
    if (booked.has(key)) return "booked" as const;
    if (blocks.has(key)) return "unavailable" as const;
    return "free" as const;
  }

  async function submit() {
    if (!selectedSlot || !topic.trim() || !teacherId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, teacherId, topic: topic.trim(), day: selectedSlot.day, slot: selectedSlot.slot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Talep gönderilemedi.");
      showSuccess("Etüt talebin gönderildi.");
      setSelectedSlot(null);
      setTopic("");
      loadMyRequests();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Talep gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <CalendarCheck className="h-4 w-4 text-brand-600" /> Birebir Etüt Talep Et
        </h2>
        <select
          value={teacherId}
          onChange={(event) => setTeacherId(event.target.value)}
          className="mb-3 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        >
          {eligibleTeachers.map((t) => (
            <option key={t.id} value={t.id}>{t.firstName} {t.lastName} · {t.subject}</option>
          ))}
        </select>

        <div className="space-y-2">
          {SCHEDULE_DAYS.map((day) => {
            const isExpanded = expandedDay === day;
            const freeCount = SCHEDULE_SLOTS.filter((slot) => slotState(day, slot) === "free").length;
            return (
              <div key={day} className="overflow-hidden rounded-2xl bg-cream-card dark:bg-white/5">
                <button onClick={() => setExpandedDay(isExpanded ? null : day)} className="flex min-h-[48px] w-full items-center justify-between px-3.5 text-left">
                  <span className="text-sm font-medium text-espresso dark:text-cream">{day}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] text-espresso-muted dark:text-cream/40">{freeCount} boş</span>
                    <ChevronDown className={cn("h-4 w-4 text-espresso-muted transition-transform dark:text-cream/40", isExpanded && "rotate-180")} />
                  </span>
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="grid grid-cols-2 gap-1.5 px-3.5 pb-3.5">
                        {SCHEDULE_SLOTS.map((slot) => {
                          const state = slotState(day, slot);
                          return (
                            <button
                              key={slot}
                              disabled={state !== "free"}
                              onClick={() => setSelectedSlot({ day, slot })}
                              className={cn(
                                "flex min-h-[40px] items-center justify-center rounded-xl text-[11px] font-medium transition",
                                state === "free" && "bg-white text-espresso hover:bg-brand-50 hover:text-brand-700 dark:bg-midnight-card dark:text-cream dark:hover:bg-brand-600/15",
                                state === "booked" && "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
                                state === "unavailable" && "bg-transparent text-espresso-muted/40 line-through dark:text-cream/20"
                              )}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Clock className="h-4 w-4 text-brand-600" /> Taleplerim
        </h2>
        <div className="space-y-2">
          {myRequests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-espresso dark:text-cream">{r.teacher.firstName} {r.teacher.lastName}</p>
                <p className="truncate text-[11px] text-espresso-muted dark:text-cream/40">{r.topic} · {r.day} {r.slot}</p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_BADGE[r.status])}>{STATUS_LABEL[r.status]}</span>
            </div>
          ))}
          {myRequests.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz etüt talebin yok.</p>}
        </div>
      </motion.div>

      <Modal isOpen={!!selectedSlot} onClose={() => setSelectedSlot(null)} title="Etüt Talebi Oluştur">
        {selectedSlot && (
          <div className="space-y-3">
            <p className="rounded-xl bg-cream-card px-3 py-2.5 text-xs text-espresso dark:bg-white/5 dark:text-cream">
              {(() => {
                const t = eligibleTeachers.find((t) => t.id === teacherId);
                return t ? `${t.firstName} ${t.lastName}` : "";
              })()} · {selectedSlot.day} {selectedSlot.slot}
            </p>
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Konu (örn. İntegral Uygulamaları)"
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
            <button
              onClick={submit}
              disabled={!topic.trim() || submitting}
              className="flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Talebi Gönder
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
