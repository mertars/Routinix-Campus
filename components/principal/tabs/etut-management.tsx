"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, Lock, Search, User, X, Loader2, Check, GraduationCap } from "lucide-react";
import { SCHEDULE_DAYS, type ScheduleDay } from "@/lib/mock-data";
import { parseSlotRange } from "@/lib/schedule-time";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Teacher = { id: string; firstName: string; lastName: string; subject: string };
type SlotDefinition = { id: string; label: string };
type LessonCell = { day: string; slot: string; subject: string; branchName: string };
type AppointmentCell = {
  id: string;
  day: string;
  slot: string;
  topic: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  student: { firstName: string; lastName: string };
};
type UnavailableCell = { day: string; slot: string };
type StudentOption = { id: string; firstName: string; lastName: string; branchName: string };

type AssignTarget = { day: ScheduleDay; slot: string } | null;

function AssignModal({
  target,
  teacherName,
  students,
  studentsLoading,
  onClose,
  onAssign,
}: {
  target: AssignTarget;
  teacherName: string;
  students: StudentOption[];
  studentsLoading: boolean;
  onClose: () => void;
  onAssign: (studentId: string, topic: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [topic, setTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!target) {
      setQuery("");
      setSelectedStudentId("");
      setTopic("");
    }
  }, [target]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return students;
    return students.filter((s) => `${s.firstName} ${s.lastName}`.toLocaleLowerCase("tr-TR").includes(q));
  }, [students, query]);

  const selected = students.find((s) => s.id === selectedStudentId);

  async function submit() {
    if (!selectedStudentId || !topic.trim()) return;
    setSubmitting(true);
    try {
      await onAssign(selectedStudentId, topic.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={!!target} onClose={onClose} title="Etüt Ataması Yap">
      {target && (
        <div className="space-y-3">
          <p className="rounded-xl bg-cream-card px-3 py-2.5 text-xs text-espresso dark:bg-white/5 dark:text-cream">
            {teacherName} · {target.day} {target.slot}
          </p>

          {selected ? (
            <div className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2.5 dark:bg-brand-600/10">
              <div>
                <p className="text-sm font-medium text-espresso dark:text-cream">
                  {selected.firstName} {selected.lastName}
                </p>
                <p className="text-[11px] text-espresso-muted dark:text-cream/40">{selected.branchName}</p>
              </div>
              <button
                onClick={() => setSelectedStudentId("")}
                className="flex h-7 w-7 items-center justify-center rounded-full text-espresso-muted hover:bg-white dark:text-cream/40 dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Öğrenci ara..."
                  className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                />
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl bg-cream-card p-1.5 dark:bg-white/5">
                {studentsLoading && <p className="px-2 py-2 text-xs text-espresso-muted dark:text-cream/40">Yükleniyor...</p>}
                {!studentsLoading &&
                  filtered.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStudentId(s.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-white dark:hover:bg-white/10"
                    >
                      <User className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                      <span className="min-w-0 flex-1 truncate text-espresso dark:text-cream">
                        {s.firstName} {s.lastName}
                      </span>
                      <span className="shrink-0 text-[10px] text-espresso-muted dark:text-cream/40">{s.branchName}</span>
                    </button>
                  ))}
                {!studentsLoading && filtered.length === 0 && (
                  <p className="px-2 py-2 text-xs text-espresso-muted dark:text-cream/40">Öğrenci bulunamadı.</p>
                )}
              </div>
            </>
          )}

          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Konu (örn. İntegral Uygulamaları)"
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />
          <button
            onClick={submit}
            disabled={!selectedStudentId || !topic.trim() || submitting}
            className="flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Ata
          </button>
        </div>
      )}
    </Modal>
  );
}

export function EtutManagementTab() {
  const { showError, showSuccess } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [slots, setSlots] = useState<SlotDefinition[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  const [lessonCells, setLessonCells] = useState<LessonCell[]>([]);
  const [appointmentCells, setAppointmentCells] = useState<AppointmentCell[]>([]);
  const [unavailableCells, setUnavailableCells] = useState<UnavailableCell[]>([]);
  const [loadingGrid, setLoadingGrid] = useState(false);

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [assignTarget, setAssignTarget] = useState<AssignTarget>(null);

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);
  const sortedSlots = useMemo(() => [...slots].sort((a, b) => parseSlotRange(a.label)[0] - parseSlotRange(b.label)[0]), [slots]);

  useEffect(() => {
    Promise.all([fetch("/api/teachers"), fetch("/api/admin/schedule-slots")])
      .then(async ([teachersRes, slotsRes]) => {
        const teachersData = await teachersRes.json();
        const slotsData = await slotsRes.json();
        const teacherList: Teacher[] = teachersData.teachers ?? [];
        setTeachers(teacherList);
        setSelectedTeacherId((current) => current || teacherList[0]?.id || "");
        setSlots(slotsData.slots ?? []);
      })
      .catch(() => showError("Öğretmen/saat listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadGrid() {
    if (!selectedTeacherId) return;
    setLoadingGrid(true);
    try {
      const [lessonRes, appointmentRes, unavailRes] = await Promise.all([
        fetch(`/api/lesson-slots?teacherId=${encodeURIComponent(selectedTeacherId)}`),
        fetch(`/api/appointments?teacherId=${encodeURIComponent(selectedTeacherId)}`),
        fetch(`/api/teacher-availability?teacherId=${encodeURIComponent(selectedTeacherId)}`),
      ]);
      const lessonData = await lessonRes.json();
      const appointmentData = await appointmentRes.json();
      const unavailData = await unavailRes.json();
      setLessonCells(
        (lessonData.slots ?? []).map((s: { day: string; slot: string; subject: string; branchName: string }) => ({
          day: s.day,
          slot: s.slot,
          subject: s.subject,
          branchName: s.branchName,
        }))
      );
      setAppointmentCells(
        (appointmentData.appointments ?? []).filter((a: AppointmentCell) => a.status !== "REJECTED")
      );
      setUnavailableCells(unavailData.blocks ?? []);
    } catch {
      showError("Öğretmenin haftalık çizelgesi yüklenemedi.");
    } finally {
      setLoadingGrid(false);
    }
  }

  useEffect(() => {
    loadGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeacherId]);

  useEffect(() => {
    setStudentsLoading(true);
    fetch("/api/admin/users/directory?role=STUDENT")
      .then((res) => res.json())
      .then((data) => setStudents((data.students ?? []).map((s: StudentOption) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, branchName: s.branchName }))))
      .catch(() => showError("Öğrenci listesi yüklenemedi."))
      .finally(() => setStudentsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function findLesson(day: ScheduleDay, slot: string) {
    return lessonCells.find((c) => c.day === day && c.slot === slot);
  }
  function findAppointment(day: ScheduleDay, slot: string) {
    return appointmentCells.find((c) => c.day === day && c.slot === slot);
  }
  function isBlocked(day: ScheduleDay, slot: string) {
    return unavailableCells.some((c) => c.day === day && c.slot === slot);
  }

  async function handleAssign(studentId: string, topic: string) {
    if (!assignTarget || !selectedTeacherId) return;
    try {
      const res = await fetch("/api/admin/etut-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: selectedTeacherId, studentId, day: assignTarget.day, slot: assignTarget.slot, topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Atama başarısız.");
      setAppointmentCells((prev) => [...prev, data.appointment]);
      setAssignTarget(null);
      showSuccess("Öğrenci etüde atandı.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Atama başarısız.");
    }
  }

  async function handleUnassign(appointmentId: string) {
    setAppointmentCells((prev) => prev.filter((c) => c.id !== appointmentId));
    try {
      const res = await fetch(`/api/admin/etut-management?id=${encodeURIComponent(appointmentId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showSuccess("Atama kaldırıldı, saat yeniden boşa düştü.");
    } catch {
      showError("Kaldırılamadı, tekrar deneyin.");
      loadGrid();
    }
  }

  if (teachers.length === 0) {
    return (
      <div className="rounded-3xl border border-hairline bg-white/70 p-8 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
        <p className="text-sm text-espresso-muted dark:text-cream/40">Etüt ataması yapmak için önce en az bir öğretmen ekleyin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={selectedTeacherId}
          onChange={(event) => setSelectedTeacherId(event.target.value)}
          className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        >
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.firstName} {teacher.lastName} — {teacher.subject}
            </option>
          ))}
        </select>
        <p className="flex items-center gap-1.5 text-[11px] text-espresso-muted dark:text-cream/40">
          <CalendarClock className="h-3.5 w-3.5" /> Boş bir hücreye tıklayarak öğrenci atayın.
        </p>
      </div>

      {sortedSlots.length === 0 && (
        <p className="rounded-2xl border border-dashed border-hairline px-4 py-3 text-xs text-espresso-muted dark:border-white/10 dark:text-cream/40">
          Henüz bir saat dilimi tanımlanmamış — &quot;Çakışmasız Ders Programı&quot; ekranından ekleyin.
        </p>
      )}

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="overflow-x-auto rounded-3xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-3 text-sm font-semibold text-espresso dark:text-cream">
          {selectedTeacher ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}` : ""} — Haftalık Çizelge
        </h2>
        <div className={cn("grid min-w-[640px] grid-cols-5 gap-2", loadingGrid && "opacity-50")}>
          {SCHEDULE_DAYS.map((day) => (
            <div key={day} className="space-y-2">
              <p className="text-center text-[11px] font-semibold text-espresso-muted dark:text-cream/40">{day}</p>
              {sortedSlots.map((slotDef) => {
                const slot = slotDef.label;
                const lesson = findLesson(day, slot);
                const appointment = findAppointment(day, slot);
                const blocked = !lesson && !appointment && isBlocked(day, slot);
                const isEmpty = !lesson && !appointment && !blocked;
                return (
                  <div
                    key={slot}
                    onClick={() => isEmpty && setAssignTarget({ day, slot })}
                    className={cn(
                      "group relative flex min-h-[68px] flex-col justify-center rounded-xl border p-2 text-center transition",
                      lesson
                        ? "border-brand-600/40 bg-brand-50 dark:bg-brand-600/10"
                        : appointment
                          ? "border-green-500/40 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10"
                          : blocked
                            ? "border-hairline bg-cream-card dark:border-white/10 dark:bg-white/5"
                            : "cursor-pointer border-dashed border-hairline hover:border-brand-500/50 hover:bg-brand-50/40 dark:border-white/10 dark:hover:bg-brand-600/10"
                    )}
                  >
                    <p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/30">{slot}</p>
                    {lesson ? (
                      <div>
                        <p className="text-[11px] font-semibold text-espresso dark:text-cream">{lesson.subject}</p>
                        <p className="text-[10px] text-espresso-muted dark:text-cream/40">{lesson.branchName}</p>
                      </div>
                    ) : appointment ? (
                      <div>
                        <p className="flex items-center justify-center gap-1 text-[11px] font-semibold text-espresso dark:text-cream">
                          <GraduationCap className="h-3 w-3 text-green-600" /> {appointment.student.firstName} {appointment.student.lastName}
                        </p>
                        <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">{appointment.topic}</p>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleUnassign(appointment.id);
                          }}
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white opacity-0 transition group-hover:opacity-100"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ) : blocked ? (
                      <Lock className="mx-auto h-3.5 w-3.5 text-espresso-muted/60 dark:text-cream/20" />
                    ) : (
                      <p className="text-[10px] text-espresso-muted/60 dark:text-cream/20">Boş</p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </motion.div>

      <AssignModal
        target={assignTarget}
        teacherName={selectedTeacher ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}` : ""}
        students={students}
        studentsLoading={studentsLoading}
        onClose={() => setAssignTarget(null)}
        onAssign={handleAssign}
      />
    </div>
  );
}
