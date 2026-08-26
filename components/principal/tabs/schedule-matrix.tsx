"use client";

import { useEffect, useState, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GripVertical, Lock, X, LayoutGrid, Table2, AlertCircle } from "lucide-react";
import { INITIAL_BRANCHES, SCHEDULE_DAYS, SCHEDULE_SLOTS, type ScheduleAssignment, type ScheduleDay, type ScheduleSlot } from "@/lib/mock-data";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Teacher = { id: string; firstName: string; lastName: string; subject: string };
type UnavailableBlock = { teacherId: string; day: string; slot: string };

type DraggingTeacher = { id: string; name: string; subject: string };

export function ScheduleMatrixTab() {
  const { showError } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [unavailable, setUnavailable] = useState<UnavailableBlock[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState(INITIAL_BRANCHES[0].id);
  const [view, setView] = useState<"edit" | "sheet">("edit");
  const [draggingTeacher, setDraggingTeacher] = useState<DraggingTeacher | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const selectedBranch = INITIAL_BRANCHES.find((branch) => branch.id === selectedBranchId)!;

  async function loadAll() {
    try {
      const [slotsRes, teachersRes] = await Promise.all([fetch("/api/lesson-slots"), fetch("/api/teachers")]);
      const slotsData = await slotsRes.json();
      const teachersData = await teachersRes.json();
      setAssignments(
        (slotsData.slots ?? []).map((s: { id: string; branchId: string; day: string; slot: string; subject: string; teacherName: string }) => ({
          id: s.id,
          branchId: s.branchId,
          day: s.day as ScheduleDay,
          slot: s.slot as ScheduleSlot,
          teacherName: s.teacherName,
          subject: s.subject,
        }))
      );
      setTeachers(teachersData.teachers ?? []);
      const unavailability = await Promise.all(
        (teachersData.teachers ?? []).map((t: Teacher) =>
          fetch(`/api/teacher-availability?teacherId=${encodeURIComponent(t.id)}`)
            .then((res) => res.json())
            .then((data) => (data.blocks ?? []).map((b: { day: string; slot: string }) => ({ teacherId: t.id, ...b })))
        )
      );
      setUnavailable(unavailability.flat());
    } catch {
      showError("Ders programı yüklenemedi.");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function findAssignment(branchId: string, day: ScheduleDay, slot: ScheduleSlot) {
    return assignments.find((row) => row.branchId === branchId && row.day === day && row.slot === slot);
  }

  function isLockedForDragging(day: ScheduleDay, slot: ScheduleSlot) {
    if (!draggingTeacher) return null;
    const conflict = assignments.find(
      (row) => row.day === day && row.slot === slot && row.teacherName === draggingTeacher.name && row.branchId !== selectedBranchId
    );
    if (conflict) return `${draggingTeacher.name} bu saatte ${INITIAL_BRANCHES.find((b) => b.id === conflict.branchId)?.name} şubesinde ders veriyor`;
    const blocked = unavailable.find((row) => row.teacherId === draggingTeacher.id && row.day === day && row.slot === slot);
    if (blocked) return `${draggingTeacher.name} bu saatte müsait değil`;
    return null;
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>, day: ScheduleDay, slot: ScheduleSlot) {
    event.preventDefault();
    if (!draggingTeacher) return;
    const lockReason = isLockedForDragging(day, slot);
    if (lockReason) {
      setConflictMessage(lockReason);
      setTimeout(() => setConflictMessage(null), 2500);
      setDraggingTeacher(null);
      return;
    }
    const teacher = draggingTeacher;
    setDraggingTeacher(null);
    try {
      const res = await fetch("/api/lesson-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: selectedBranchId, teacherId: teacher.id, subject: teacher.subject, day, slot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Atama başarısız.");
      setAssignments((prev) => [
        ...prev.filter((row) => !(row.branchId === selectedBranchId && row.day === day && row.slot === slot)),
        { id: data.slot.id, branchId: selectedBranchId, day, slot, teacherName: teacher.name, subject: teacher.subject },
      ]);
    } catch (error) {
      setConflictMessage(error instanceof Error ? error.message : "Atama başarısız.");
      setTimeout(() => setConflictMessage(null), 2500);
    }
  }

  async function removeAssignment(day: ScheduleDay, slot: ScheduleSlot) {
    setAssignments((prev) => prev.filter((row) => !(row.branchId === selectedBranchId && row.day === day && row.slot === slot)));
    try {
      await fetch(`/api/lesson-slots?branchId=${encodeURIComponent(selectedBranchId)}&day=${encodeURIComponent(day)}&slot=${encodeURIComponent(slot)}`, {
        method: "DELETE",
      });
    } catch {
      showError("Silinemedi, tekrar deneyin.");
      loadAll();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={selectedBranchId}
          onChange={(event) => setSelectedBranchId(event.target.value)}
          disabled={view === "sheet"}
          className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 disabled:opacity-50 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        >
          {INITIAL_BRANCHES.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>

        <div className="flex gap-1.5 rounded-full border border-hairline bg-white/70 p-1 dark:border-white/10 dark:bg-midnight-card/50">
          <button
            onClick={() => setView("edit")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              view === "edit" ? "bg-brand-600 text-white" : "text-espresso-muted dark:text-cream/40"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Dağıtım
          </button>
          <button
            onClick={() => setView("sheet")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              view === "sheet" ? "bg-brand-600 text-white" : "text-espresso-muted dark:text-cream/40"
            )}
          >
            <Table2 className="h-3.5 w-3.5" /> Çarşaf Liste
          </button>
        </div>
      </div>

      <AnimatePresence>
        {conflictMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0" /> Çakışma: {conflictMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {view === "edit" ? (
        <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
          <motion.div
            whileHover={{ scale: 1.005, y: -2 }}
            className="rounded-3xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
          >
            <p className="mb-3 text-xs font-semibold text-espresso dark:text-cream">Öğretmen Paleti</p>
            <div className="space-y-2">
              {teachers.map((teacher) => (
                <div
                  key={teacher.id}
                  draggable
                  onDragStart={() => setDraggingTeacher({ id: teacher.id, name: `${teacher.firstName} ${teacher.lastName}`, subject: teacher.subject })}
                  onDragEnd={() => setDraggingTeacher(null)}
                  className="flex cursor-grab items-center gap-2 rounded-xl bg-cream-card px-3 py-2 text-xs active:cursor-grabbing dark:bg-white/5"
                >
                  <GripVertical className="h-3.5 w-3.5 shrink-0 text-espresso-muted dark:text-cream/40" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-espresso dark:text-cream">{teacher.firstName} {teacher.lastName}</p>
                    <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">{teacher.subject}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-espresso-muted dark:text-cream/40">
              Bir öğretmeni sürükleyip {selectedBranch.name} takviminde uygun bir hücreye bırakın.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.005, y: -2 }}
            className="overflow-x-auto rounded-3xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
          >
            <h2 className="mb-3 text-sm font-semibold text-espresso dark:text-cream">{selectedBranch.name} — Haftalık Program</h2>
            <div className="grid min-w-[640px] grid-cols-5 gap-2">
              {SCHEDULE_DAYS.map((day) => (
                <div key={day} className="space-y-2">
                  <p className="text-center text-[11px] font-semibold text-espresso-muted dark:text-cream/40">{day}</p>
                  {SCHEDULE_SLOTS.map((slot) => {
                    const assignment = findAssignment(selectedBranchId, day, slot);
                    const lockReason = isLockedForDragging(day, slot);
                    return (
                      <div
                        key={slot}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDrop(event, day, slot)}
                        className={cn(
                          "flex min-h-[64px] flex-col justify-center rounded-xl border p-2 text-center transition",
                          assignment
                            ? "border-brand-600/40 bg-brand-50 dark:bg-brand-600/10"
                            : lockReason
                              ? "border-rose-300 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10"
                              : "border-dashed border-hairline dark:border-white/10"
                        )}
                      >
                        <p className="mb-1 text-[9px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/30">
                          {slot}
                        </p>
                        {assignment ? (
                          <div className="group relative">
                            <p className="text-[11px] font-semibold text-espresso dark:text-cream">{assignment.teacherName}</p>
                            <p className="text-[10px] text-espresso-muted dark:text-cream/40">{assignment.subject}</p>
                            <button
                              onClick={() => removeAssignment(day, slot)}
                              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white opacity-0 transition group-hover:opacity-100"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ) : lockReason ? (
                          <Lock className="mx-auto h-3.5 w-3.5 text-rose-500" />
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
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {SCHEDULE_DAYS.map((day) => (
            <div
              key={day}
              className="overflow-x-auto rounded-3xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
            >
              <h3 className="mb-2 text-xs font-semibold text-espresso dark:text-cream">{day}</h3>
              <table className="w-full min-w-[560px] border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="border-b border-hairline px-2 py-1.5 text-left font-medium text-espresso-muted dark:border-white/10 dark:text-cream/40">
                      Şube
                    </th>
                    {SCHEDULE_SLOTS.map((slot) => (
                      <th
                        key={slot}
                        className="border-b border-hairline px-2 py-1.5 text-left font-medium text-espresso-muted dark:border-white/10 dark:text-cream/40"
                      >
                        {slot}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {INITIAL_BRANCHES.map((branch) => (
                    <tr key={branch.id} className="border-b border-hairline last:border-0 dark:border-white/5">
                      <td className="px-2 py-1.5 font-medium text-espresso dark:text-cream">{branch.name}</td>
                      {SCHEDULE_SLOTS.map((slot) => {
                        const assignment = findAssignment(branch.id, day, slot);
                        return (
                          <td key={slot} className="px-2 py-1.5">
                            {assignment ? (
                              <span className="text-espresso dark:text-cream">
                                {assignment.teacherName} <span className="text-espresso-muted dark:text-cream/40">· {assignment.subject}</span>
                              </span>
                            ) : (
                              <span className="text-espresso-muted/50 dark:text-cream/20">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
