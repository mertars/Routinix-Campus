"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GripVertical, Lock, X, LayoutGrid, Table2, AlertCircle, Clock3, Plus, Pencil, Trash2, Check } from "lucide-react";
import { SCHEDULE_DAYS, type ScheduleAssignment, type ScheduleDay } from "@/lib/mock-data";
import { parseSlotRange } from "@/lib/schedule-time";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Branch = { id: string; name: string };
type Teacher = { id: string; firstName: string; lastName: string; subject: string };
type UnavailableBlock = { teacherId: string; day: string; slot: string };
type SlotDefinition = { id: string; label: string };

type DraggingTeacher = { id: string; name: string; subject: string };

const inputClass =
  "rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream";

// Saat dilimi yönetimi — kurumun ders programı ekranı önceden sabit 4
// saate (SCHEDULE_SLOTS, lib/mock-data.ts) kilitliydi. Artık yönetici
// kendi kurumunun gerçek çalışma saatlerine göre ekleyip/silip/yeniden
// adlandırabiliyor (bkz. ScheduleSlotDefinition şeması). Etiket HER ZAMAN
// "HH:MM-HH:MM" formatında olmalı — bu yüzden serbest metin yerine
// başlangıç/bitiş saat seçicileri kullanılır.
function SlotManagerModal({
  isOpen,
  onClose,
  slots,
  onChanged,
}: {
  isOpen: boolean;
  onClose: () => void;
  slots: SlotDefinition[];
  onChanged: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [newStart, setNewStart] = useState("16:00");
  const [newEnd, setNewEnd] = useState("17:00");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleAdd() {
    setAdding(true);
    try {
      const res = await fetch("/api/admin/schedule-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: `${newStart}-${newEnd}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Saat dilimi eklenemedi.");
      onChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Saat dilimi eklenemedi.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(slot: SlotDefinition) {
    const [start, end] = slot.label.split("-");
    setEditingId(slot.id);
    setEditStart(start ?? "16:00");
    setEditEnd(end ?? "17:00");
  }

  async function handleSaveEdit(id: string) {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/schedule-slots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: `${editStart}-${editEnd}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Yeniden adlandırılamadı.");
      showSuccess("Saat dilimi güncellendi.");
      setEditingId(null);
      onChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Yeniden adlandırılamadı.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/schedule-slots/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Silinemedi.");
      showSuccess("Saat dilimi silindi.");
      setConfirmDeleteId(null);
      onChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Silinemedi.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ders Programı Saat Dilimleri">
      <div className="space-y-3">
        <div className="space-y-1.5">
          {slots.map((slot) => (
            <div key={slot.id} className="flex items-center justify-between gap-2 rounded-xl bg-cream-card px-3 py-2 dark:bg-white/5">
              {editingId === slot.id ? (
                <div className="flex flex-1 items-center gap-1.5">
                  <input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} className={inputClass} />
                  <span className="text-espresso-muted dark:text-cream/40">–</span>
                  <input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className={inputClass} />
                </div>
              ) : (
                <span className="text-sm font-medium text-espresso dark:text-cream">{slot.label}</span>
              )}

              {confirmDeleteId === slot.id ? (
                <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
                  <span className="text-espresso-muted dark:text-cream/40">Emin misin?</span>
                  <button onClick={() => setConfirmDeleteId(null)} className="rounded-lg px-2 py-1 text-espresso-muted hover:bg-white dark:text-cream/40 dark:hover:bg-white/10">
                    Vazgeç
                  </button>
                  <button
                    onClick={() => handleDelete(slot.id)}
                    disabled={deleting}
                    className="rounded-lg bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Sil
                  </button>
                </div>
              ) : editingId === slot.id ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleSaveEdit(slot.id)}
                    disabled={savingEdit}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-green-600 hover:bg-green-100 dark:hover:bg-green-500/20"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-espresso-muted hover:bg-white dark:text-cream/40 dark:hover:bg-white/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => startEdit(slot)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-espresso-muted hover:bg-white dark:text-cream/40 dark:hover:bg-white/10"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(slot.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-espresso-muted hover:bg-red-100 hover:text-red-600 dark:text-cream/40 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {slots.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz saat dilimi eklenmemiş.</p>}
        </div>

        <div className="flex items-center gap-1.5 border-t border-hairline pt-3 dark:border-white/10">
          <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className={inputClass} />
          <span className="text-espresso-muted dark:text-cream/40">–</span>
          <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className={inputClass} />
          <button
            onClick={handleAdd}
            disabled={adding}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-espresso px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <Plus className="h-3.5 w-3.5" /> Ekle
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ScheduleMatrixTab() {
  const { showError } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [slots, setSlots] = useState<SlotDefinition[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [unavailable, setUnavailable] = useState<UnavailableBlock[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [view, setView] = useState<"edit" | "sheet">("edit");
  const [draggingTeacher, setDraggingTeacher] = useState<DraggingTeacher | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [isSlotManagerOpen, setIsSlotManagerOpen] = useState(false);

  const sortedSlots = useMemo(() => [...slots].sort((a, b) => parseSlotRange(a.label)[0] - parseSlotRange(b.label)[0]), [slots]);
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId);

  // Izgara (gün×saat, şube×saat) hücre başına O(1) arama için ön-indekslenmiş
  // bakış tabloları — önceden her hücre TÜM assignments/unavailable dizisini
  // .find() ile tarıyordu (kurum büyüdükçe fark yaratan bir maliyet).
  const assignmentByKey = useMemo(() => {
    const map = new Map<string, ScheduleAssignment>();
    for (const row of assignments) map.set(`${row.branchId}|${row.day}|${row.slot}`, row);
    return map;
  }, [assignments]);

  const assignmentsByDaySlot = useMemo(() => {
    const map = new Map<string, ScheduleAssignment[]>();
    for (const row of assignments) {
      const key = `${row.day}|${row.slot}`;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [assignments]);

  const unavailableSet = useMemo(() => {
    const set = new Set<string>();
    for (const row of unavailable) set.add(`${row.teacherId}|${row.day}|${row.slot}`);
    return set;
  }, [unavailable]);

  async function loadAll() {
    try {
      const [branchesRes, slotsRes, lessonSlotsRes, teachersRes] = await Promise.all([
        fetch("/api/admin/branches"),
        fetch("/api/admin/schedule-slots"),
        fetch("/api/lesson-slots"),
        fetch("/api/teachers"),
      ]);
      const branchesData = await branchesRes.json();
      const slotsData = await slotsRes.json();
      const lessonSlotsData = await lessonSlotsRes.json();
      const teachersData = await teachersRes.json();

      const branchList: Branch[] = branchesData.branches ?? [];
      setBranches(branchList);
      setSelectedBranchId((current) => current || branchList[0]?.id || "");
      setSlots(slotsData.slots ?? []);
      setAssignments(
        (lessonSlotsData.slots ?? []).map(
          (s: { id: string; branchId: string; branchName: string; day: string; slot: string; subject: string; teacherName: string }) => ({
            id: s.id,
            branchId: s.branchId,
            branchName: s.branchName,
            day: s.day as ScheduleDay,
            slot: s.slot,
            teacherName: s.teacherName,
            subject: s.subject,
          })
        )
      );
      setTeachers(teachersData.teachers ?? []);
      // Önceden öğretmen başına ayrı bir istek atılıyordu (N round-trip);
      // artık tüm öğretmenlerin müsaitliği tek toplu istekte geliyor
      // (bkz. app/api/teacher-availability/route.ts > ?teacherIds=).
      const teacherIds: string[] = (teachersData.teachers ?? []).map((t: Teacher) => t.id);
      if (teacherIds.length > 0) {
        const unavailRes = await fetch(`/api/teacher-availability?teacherIds=${teacherIds.map(encodeURIComponent).join(",")}`);
        const unavailData = await unavailRes.json();
        setUnavailable(unavailData.blocks ?? []);
      } else {
        setUnavailable([]);
      }
    } catch {
      showError("Ders programı yüklenemedi.");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function findAssignment(branchId: string, day: ScheduleDay, slot: string) {
    return assignmentByKey.get(`${branchId}|${day}|${slot}`);
  }

  function isLockedForDragging(day: ScheduleDay, slot: string) {
    if (!draggingTeacher) return null;
    const candidates = assignmentsByDaySlot.get(`${day}|${slot}`) ?? [];
    const conflict = candidates.find((row) => row.teacherName === draggingTeacher.name && row.branchId !== selectedBranchId);
    if (conflict) return `${draggingTeacher.name} bu saatte ${branches.find((b) => b.id === conflict.branchId)?.name} şubesinde ders veriyor`;
    if (unavailableSet.has(`${draggingTeacher.id}|${day}|${slot}`)) return `${draggingTeacher.name} bu saatte müsait değil`;
    return null;
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>, day: ScheduleDay, slot: string) {
    event.preventDefault();
    if (!draggingTeacher || !selectedBranch) return;
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
        { id: data.slot.id, branchId: selectedBranchId, branchName: selectedBranch.name, day, slot, teacherName: teacher.name, subject: teacher.subject },
      ]);
    } catch (error) {
      setConflictMessage(error instanceof Error ? error.message : "Atama başarısız.");
      setTimeout(() => setConflictMessage(null), 2500);
    }
  }

  async function removeAssignment(day: ScheduleDay, slot: string) {
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

  if (!selectedBranch) {
    return (
      <div className="rounded-3xl border border-hairline bg-white/70 p-8 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
        <p className="text-sm text-espresso-muted dark:text-cream/40">Ders programı oluşturmak için önce en az bir şube ekleyin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
            disabled={view === "sheet"}
            className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 disabled:opacity-50 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setIsSlotManagerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
          >
            <Clock3 className="h-3.5 w-3.5" /> Saatleri Yönet
          </button>
        </div>

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

      {sortedSlots.length === 0 && (
        <p className="rounded-2xl border border-dashed border-hairline px-4 py-3 text-xs text-espresso-muted dark:border-white/10 dark:text-cream/40">
          Henüz bir saat dilimi tanımlanmamış — &quot;Saatleri Yönet&quot; ile ekleyin.
        </p>
      )}

      {view === "edit" ? (
        <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
          <motion.div
            whileHover={{ scale: 1.005, y: -2 }}
            className="rounded-3xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
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
            className="overflow-x-auto rounded-3xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
          >
            <h2 className="mb-3 text-sm font-semibold text-espresso dark:text-cream">{selectedBranch.name} — Haftalık Program</h2>
            <div className="grid min-w-[640px] grid-cols-5 gap-2">
              {SCHEDULE_DAYS.map((day) => (
                <div key={day} className="space-y-2">
                  <p className="text-center text-[11px] font-semibold text-espresso-muted dark:text-cream/40">{day}</p>
                  {sortedSlots.map((slotDef) => {
                    const slot = slotDef.label;
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
              className="overflow-x-auto rounded-3xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
            >
              <h3 className="mb-2 text-xs font-semibold text-espresso dark:text-cream">{day}</h3>
              <table className="w-full min-w-[560px] border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="border-b border-hairline px-2 py-1.5 text-left font-medium text-espresso-muted dark:border-white/10 dark:text-cream/40">
                      Şube
                    </th>
                    {sortedSlots.map((slotDef) => (
                      <th
                        key={slotDef.id}
                        className="border-b border-hairline px-2 py-1.5 text-left font-medium text-espresso-muted dark:border-white/10 dark:text-cream/40"
                      >
                        {slotDef.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {branches.map((branch) => (
                    <tr key={branch.id} className="border-b border-hairline last:border-0 dark:border-white/5">
                      <td className="px-2 py-1.5 font-medium text-espresso dark:text-cream">{branch.name}</td>
                      {sortedSlots.map((slotDef) => {
                        const assignment = findAssignment(branch.id, day, slotDef.label);
                        return (
                          <td key={slotDef.id} className="px-2 py-1.5">
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

      <SlotManagerModal isOpen={isSlotManagerOpen} onClose={() => setIsSlotManagerOpen(false)} slots={sortedSlots} onChanged={loadAll} />
    </div>
  );
}
