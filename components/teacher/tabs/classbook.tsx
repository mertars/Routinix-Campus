"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, CheckCircle2, Circle, NotebookPen, Plus, CalendarRange, FileText } from "lucide-react";
import { CURRICULUM_TREE, type GradeLevel } from "@/lib/mock-data";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { YearlyPlanPrintModal } from "@/components/teacher/yearly-plan-print-modal";
import { cn } from "@/lib/utils";

type ClassbookNote = { id: string; branchId: string; note: string; createdAt: string };
type YearlyPlanRow = { id: string; weekLabel: string; subtopicName: string; notes: string | null };

export function ClassbookTab() {
  const { teacherName, staffRecord, subject, assignedBranches } = useTeacherScope();
  const { showError } = useToast();
  const [view, setView] = useState<"curriculum" | "plan">("curriculum");
  const [branchId, setBranchId] = useState(assignedBranches[0]?.id ?? "");
  const [notes, setNotes] = useState<ClassbookNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [coveredMap, setCoveredMap] = useState<Record<string, boolean>>({});
  const [myPlan, setMyPlan] = useState<YearlyPlanRow[]>([]);

  useEffect(() => {
    if (assignedBranches.length > 0 && !branchId) setBranchId(assignedBranches[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedBranches]);

  const grades = useMemo(
    () => Array.from(new Set(assignedBranches.map((b) => b.grade).filter((g): g is GradeLevel => g !== undefined))).sort(),
    [assignedBranches]
  );
  const [gradeFilter, setGradeFilter] = useState<GradeLevel | "Tümü">("Tümü");

  const tree = CURRICULUM_TREE[subject] ?? [];
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!branchId) return;
    fetch(`/api/curriculum-progress?branchId=${encodeURIComponent(branchId)}`)
      .then((res) => res.json())
      .then((data) => {
        const map: Record<string, boolean> = {};
        tree.forEach((topic) => topic.subtopics.forEach((sub) => (map[sub.id] = sub.covered)));
        (data.progress ?? []).forEach((row: { subtopicId: string; covered: boolean }) => (map[row.subtopicId] = row.covered));
        setCoveredMap(map);
      })
      .catch(() => showError("Müfredat ilerlemesi yüklenemedi."));
    fetch(`/api/classbook-notes?branchId=${encodeURIComponent(branchId)}`)
      .then((res) => res.json())
      .then((data) => setNotes(data.notes ?? []))
      .catch(() => showError("Sınıf defteri notları yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, subject]);

  useEffect(() => {
    fetch(`/api/yearly-plan?teacherId=${encodeURIComponent(staffRecord.id)}`)
      .then((res) => res.json())
      .then((data) => setMyPlan(data.rows ?? []))
      .catch(() => showError("Yıllık plan yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffRecord.id]);

  const filteredTree = gradeFilter === "Tümü" ? tree : tree.filter((topic) => topic.grade === gradeFilter);
  const allSubtopics = tree.flatMap((t) => t.subtopics);
  const coveredCount = allSubtopics.filter((s) => coveredMap[s.id]).length;
  const progress = allSubtopics.length ? Math.round((coveredCount / allSubtopics.length) * 100) : 0;

  const branch = assignedBranches.find((b) => b.id === branchId);

  // Yıllık plan
  const [weekLabel, setWeekLabel] = useState("");
  const [subtopicName, setSubtopicName] = useState(allSubtopics[0]?.name ?? "");
  const [planNotes, setPlanNotes] = useState("");
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  async function toggleSubtopic(id: string) {
    if (!branchId) return;
    const next = !coveredMap[id];
    setCoveredMap((prev) => ({ ...prev, [id]: next }));
    try {
      const res = await fetch("/api/curriculum-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, subject, subtopicId: id, covered: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setCoveredMap((prev) => ({ ...prev, [id]: !next }));
      showError("Kaydedilemedi, tekrar deneyin.");
    }
  }

  async function addNote() {
    if (!noteDraft.trim() || !branch) return;
    const draft = noteDraft;
    setNoteDraft("");
    try {
      const res = await fetch("/api/classbook-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: staffRecord.id, branchId: branch.id, note: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setNotes((prev) => [data.note, ...prev]);
    } catch {
      showError("Not eklenemedi.");
    }
  }

  async function addPlanRow() {
    if (!weekLabel.trim() || !subtopicName.trim()) return;
    try {
      const res = await fetch("/api/yearly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: staffRecord.id, weekLabel, subtopicName, notes: planNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setMyPlan((prev) => [data.row, ...prev]);
      setWeekLabel("");
      setPlanNotes("");
    } catch {
      showError("Plan satırı eklenemedi.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 rounded-full border border-hairline bg-white/70 p-1 dark:border-white/10 dark:bg-midnight-card/50">
        <button
          onClick={() => setView("curriculum")}
          className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition", view === "curriculum" ? "bg-brand-600 text-white" : "text-espresso-muted dark:text-cream/40")}
        >
          <BookOpen className="h-3.5 w-3.5" /> Müfredat
        </button>
        <button
          onClick={() => setView("plan")}
          className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition", view === "plan" ? "bg-brand-600 text-white" : "text-espresso-muted dark:text-cream/40")}
        >
          <CalendarRange className="h-3.5 w-3.5" /> Yıllık Plan
        </button>
      </div>

      {view === "curriculum" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <motion.div
            whileHover={{ scale: 1.005, y: -2 }}
            className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
                <BookOpen className="h-4 w-4 text-brand-600" /> Müfredat Ağacı
              </h2>
              <span className="text-xs font-medium text-espresso-muted dark:text-cream/40">
                {coveredCount}/{allSubtopics.length} kazanım · %{progress}
              </span>
            </div>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
              <motion.div className="h-full rounded-full bg-brand-600" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ type: "spring", stiffness: 70, damping: 15 }} />
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              <button
                onClick={() => setGradeFilter("Tümü")}
                className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition", gradeFilter === "Tümü" ? "border-brand-600 bg-brand-600 text-white" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/40")}
              >
                Tüm Sınıflar
              </button>
              {grades.map((grade) => (
                <button
                  key={grade}
                  onClick={() => setGradeFilter(grade)}
                  className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition", gradeFilter === grade ? "border-brand-600 bg-brand-600 text-white" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/40")}
                >
                  {grade}. Sınıf
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredTree.map((topic) => (
                <div key={topic.id} className="rounded-xl bg-cream-card dark:bg-white/5">
                  <button
                    onClick={() => setExpandedTopics((prev) => ({ ...prev, [topic.id]: !prev[topic.id] }))}
                    className="flex w-full items-center justify-between px-3 py-2 text-left"
                  >
                    <span className="text-sm font-medium text-espresso dark:text-cream">
                      {topic.name} <span className="text-[10px] text-espresso-muted dark:text-cream/40">· {topic.grade}. Sınıf</span>
                    </span>
                    <span className="text-[10px] text-espresso-muted dark:text-cream/40">
                      {topic.subtopics.filter((s) => coveredMap[s.id]).length}/{topic.subtopics.length}
                    </span>
                  </button>
                  {expandedTopics[topic.id] && (
                    <div className="space-y-1 px-3 pb-2">
                      {topic.subtopics.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => toggleSubtopic(sub.id)}
                          className="flex w-full items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-left text-xs transition hover:bg-brand-50 dark:bg-midnight-card dark:hover:bg-brand-600/10"
                        >
                          <span className="flex items-center gap-1.5 text-espresso dark:text-cream">
                            {coveredMap[sub.id] ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 shrink-0 text-espresso-muted dark:text-cream/30" />
                            )}
                            {sub.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {filteredTree.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Bu sınıf seviyesinde konu yok.</p>}
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.005, y: -2 }}
            className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
          >
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
              <NotebookPen className="h-4 w-4 text-brand-600" /> Dijital Sınıf Defteri
            </h2>
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="mb-3 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            >
              {assignedBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <div className="mb-4 flex gap-2">
              <input
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Bugün işlenen konu / not ekleyin"
                className="flex-1 rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
              />
              <button onClick={addNote} className="flex items-center gap-1 rounded-lg bg-espresso px-3 py-2 text-xs font-medium text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500">
                <Plus className="h-3.5 w-3.5" /> Ekle
              </button>
            </div>
            <div className="space-y-2">
              {notes.map((note) => (
                <motion.div key={note.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
                  <p className="text-sm text-espresso dark:text-cream">{note.note}</p>
                  <p className="mt-0.5 text-[10px] text-espresso-muted dark:text-cream/40">{new Date(note.createdAt).toLocaleString("tr-TR")}</p>
                </motion.div>
              ))}
              {notes.length === 0 && (
                <p className="text-xs text-espresso-muted dark:text-cream/40">Bu şube için henüz not girilmedi.</p>
              )}
            </div>
          </motion.div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
              <CalendarRange className="h-4 w-4 text-brand-600" /> Özelleştirilmiş Yıllık Plan
            </h2>
            <button
              onClick={() => setIsPrintOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
            >
              <FileText className="h-3.5 w-3.5" /> PDF Çıktı Al
            </button>
          </div>

          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <input
              value={weekLabel}
              onChange={(event) => setWeekLabel(event.target.value)}
              placeholder="Hafta (örn. 1. Hafta)"
              className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
            <select
              value={subtopicName}
              onChange={(event) => setSubtopicName(event.target.value)}
              className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            >
              {allSubtopics.map((sub) => (
                <option key={sub.id} value={sub.name}>
                  {sub.name}
                </option>
              ))}
            </select>
            <input
              value={planNotes}
              onChange={(event) => setPlanNotes(event.target.value)}
              placeholder="Not (opsiyonel)"
              className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </div>
          <button
            onClick={addPlanRow}
            className="mb-4 flex items-center gap-1.5 rounded-lg bg-espresso px-3 py-2 text-xs font-medium text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <Plus className="h-3.5 w-3.5" /> Plana Ekle
          </button>

          <div className="space-y-1.5">
            {myPlan.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-xl bg-cream-card px-3 py-2 text-xs dark:bg-white/5">
                <span className="font-medium text-espresso dark:text-cream">{row.weekLabel}</span>
                <span className="text-espresso-muted dark:text-cream/40">{row.subtopicName}</span>
              </div>
            ))}
            {myPlan.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz plan satırı eklenmedi.</p>}
          </div>
        </motion.div>
      )}

      <YearlyPlanPrintModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        teacherName={teacherName}
        subject={subject}
        rows={myPlan.map((r) => ({ id: r.id, teacherName, weekLabel: r.weekLabel, subtopicName: r.subtopicName, notes: r.notes ?? "" }))}
      />
    </div>
  );
}
