"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Check, Clock, Loader2, BookOpen, UserCog } from "lucide-react";
import { SCHEDULE_DAYS, type ScheduleDay } from "@/lib/mock-data";
import { useStudentScope } from "@/lib/student-scope";
import { useEtutAdminManaged } from "@/lib/institution-scope";
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
  const isAdminManaged = useEtutAdminManaged();
  const { showError, showSuccess } = useToast();

  const [eligibleTeachers, setEligibleTeachers] = useState<EligibleTeacher[]>([]);
  const [subject, setSubject] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [day, setDay] = useState<ScheduleDay>(SCHEDULE_DAYS[0]);

  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState<AppointmentEntry[]>([]);

  useEffect(() => {
    if (!branchId) return;
    fetch(`/api/teachers?branchId=${encodeURIComponent(branchId)}&excludeSubject=${encodeURIComponent("Rehberlik")}`)
      .then((res) => res.json())
      .then((data) => {
        const teachers: EligibleTeacher[] = data.teachers ?? [];
        setEligibleTeachers(teachers);
        setSubject((current) => current || teachers[0]?.subject || "");
      })
      .catch(() => showError("Öğretmen listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const subjects = useMemo(() => [...new Set(eligibleTeachers.map((t) => t.subject))], [eligibleTeachers]);
  const teachersForSubject = useMemo(() => eligibleTeachers.filter((t) => t.subject === subject), [eligibleTeachers, subject]);

  useEffect(() => {
    setTeacherId((current) => (teachersForSubject.some((t) => t.id === current) ? current : teachersForSubject[0]?.id ?? ""));
  }, [teachersForSubject]);

  async function loadSlots() {
    if (!teacherId) return;
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/etut/available-slots?teacherId=${encodeURIComponent(teacherId)}&day=${encodeURIComponent(day)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Müsaitlik yüklenemedi.");
      setSlots(data.slots ?? []);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Müsaitlik yüklenemedi.");
    } finally {
      setSlotsLoading(false);
    }
  }

  useEffect(() => {
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, day]);

  async function loadMyRequests() {
    if (!studentId) return;
    try {
      const res = await fetch(`/api/appointments?studentId=${encodeURIComponent(studentId)}`);
      const data = await res.json();
      setMyRequests(data.appointments ?? []);
    } catch {
      showError("Taleplerin yüklenemedi.");
    }
  }

  useEffect(() => {
    loadMyRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function submit() {
    if (!selectedSlot || !topic.trim() || !teacherId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, topic: topic.trim(), day, slot: selectedSlot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Talep gönderilemedi.");
      showSuccess("Etüt talebin gönderildi.");
      setSelectedSlot(null);
      setTopic("");
      loadMyRequests();
      loadSlots(); // az önce talep edilen (artık PENDING) slot listeden düşer
    } catch (error) {
      showError(error instanceof Error ? error.message : "Talep gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedTeacher = eligibleTeachers.find((t) => t.id === teacherId);

  return (
    <div className="space-y-4">
      {isAdminManaged && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2.5 rounded-2xl border border-hairline bg-white/70 px-4 py-3 text-xs text-espresso-muted shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream/50"
        >
          <UserCog className="h-4 w-4 shrink-0 text-brand-600" />
          Etüt saatleri kurum yöneticisi tarafından atanıyor — sana ayarlanan etütleri aşağıda &quot;Taleplerim&quot; altında görebilirsin.
        </motion.div>
      )}

      {!isAdminManaged && (
      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <CalendarCheck className="h-4 w-4 text-brand-600" /> Birebir Etüt Talep Et
        </h2>

        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-espresso-muted dark:text-cream/40">
          <BookOpen className="h-3 w-3" /> Ders
        </p>
        <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition",
                s === subject ? "bg-brand-600 text-white" : "bg-cream-card text-espresso dark:bg-white/5 dark:text-cream"
              )}
            >
              {s}
            </button>
          ))}
          {subjects.length === 0 && <p className="py-2 text-xs text-espresso-muted dark:text-cream/40">Ders listesi yükleniyor...</p>}
        </div>

        <p className="mb-1.5 text-[11px] font-medium text-espresso-muted dark:text-cream/40">Öğretmen</p>
        <select
          value={teacherId}
          onChange={(event) => setTeacherId(event.target.value)}
          className="mb-3 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        >
          {teachersForSubject.map((t) => (
            <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
          ))}
        </select>

        <p className="mb-1.5 text-[11px] font-medium text-espresso-muted dark:text-cream/40">Gün</p>
        <div className="mb-3 grid grid-cols-5 gap-1.5">
          {SCHEDULE_DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={cn(
                "min-h-[40px] rounded-lg text-[11px] font-medium transition",
                d === day ? "bg-espresso text-cream dark:bg-brand-600" : "bg-cream-card text-espresso dark:bg-white/5 dark:text-cream"
              )}
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </div>

        <p className="mb-1.5 text-[11px] font-medium text-espresso-muted dark:text-cream/40">Müsait Saatler</p>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {slots.map((slot) => (
            <button
              key={slot}
              onClick={() => setSelectedSlot(slot)}
              className="flex min-h-[40px] items-center justify-center rounded-xl bg-white text-[11px] font-medium text-espresso transition hover:bg-brand-50 hover:text-brand-700 dark:bg-midnight-card dark:text-cream dark:hover:bg-brand-600/15"
            >
              {slot}
            </button>
          ))}
        </div>
        {slotsLoading && <p className="mt-2 text-xs text-espresso-muted dark:text-cream/40">Müsaitlik hesaplanıyor...</p>}
        {!slotsLoading && slots.length === 0 && (
          <p className="mt-2 text-xs text-espresso-muted dark:text-cream/40">{selectedTeacher ? `${selectedTeacher.firstName} ${selectedTeacher.lastName} bu gün için müsait değil.` : "Öğretmen seçin."}</p>
        )}
      </motion.div>
      )}

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
              {selectedTeacher ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}` : ""} · {day} {selectedSlot}
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
