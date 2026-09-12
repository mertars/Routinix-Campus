"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, CheckCircle2, Circle, NotebookPen, Plus, CalendarRange, FileText, Loader2 } from "lucide-react";
import { CURRICULUM_TREE, type GradeLevel } from "@/lib/mock-data";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { fetchAndDownloadPdf } from "@/lib/client/download-pdf";
import { cn } from "@/lib/utils";

type ClassbookNote = { id: string; branchId: string; note: string; noteDate: string | null; createdAt: string };
type YearlyPlanRow = { id: string; weekLabel: string; subtopicName: string; notes: string | null; covered: boolean; grade: number | null };

export function ClassbookTab() {
  const { teacherName, staffRecord, subject, assignedBranches } = useTeacherScope();
  const { showError } = useToast();
  const [view, setView] = useState<"curriculum" | "plan">("curriculum");
  const [branchId, setBranchId] = useState(assignedBranches[0]?.id ?? "");
  const [notes, setNotes] = useState<ClassbookNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  // "Zaman ekle" — boş bırakılırsa (varsayılan) not "şimdi" ile kaydedilir,
  // eski davranış aynen korunur; doldurulursa GEÇMİŞ bir tarih/saat seçilebilir.
  const [noteDateDraft, setNoteDateDraft] = useState("");
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
  const [downloadingPlanPdf, setDownloadingPlanPdf] = useState(false);
  // Sınıf seviyesi başına ayrı plan — kullanıcı bulgusu: tek öğretmenin
  // TÜM sınıf/dersleri için tek ortak plan vardı. "Tümü" eski kayıtları
  // (grade=null) da gösterir, geriye dönük kırılmaz.
  const [planGradeFilter, setPlanGradeFilter] = useState<GradeLevel | "Tümü">("Tümü");
  const filteredPlan = planGradeFilter === "Tümü" ? myPlan : myPlan.filter((row) => row.grade === planGradeFilter);

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
    const draftDate = noteDateDraft;
    setNoteDraft("");
    setNoteDateDraft("");
    try {
      const res = await fetch("/api/classbook-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: staffRecord.id, branchId: branch.id, note: draft, noteDate: draftDate || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      // Geçmişe dönük eklenmiş bir not en üste değil, GERÇEK tarihine göre
      // doğru sıraya düşmeli (bkz. GET route'taki AYNI sıralama mantığı).
      setNotes((prev) =>
        [data.note, ...prev].sort(
          (a, b) => new Date(b.noteDate ?? b.createdAt).getTime() - new Date(a.noteDate ?? a.createdAt).getTime()
        )
      );
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
        body: JSON.stringify({
          teacherId: staffRecord.id,
          weekLabel,
          subtopicName,
          notes: planNotes,
          grade: planGradeFilter === "Tümü" ? undefined : planGradeFilter,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      // Yeni satır her zaman en SONA eklenir (weekOrder artan) — en üste
      // değil, aksi halde ekranda "son eklenen üstte" hatası geri gelir.
      setMyPlan((prev) => [...prev, data.row]);
      setWeekLabel("");
      setPlanNotes("");
    } catch {
      showError("Plan satırı eklenemedi.");
    }
  }

  async function toggleCovered(id: string, covered: boolean) {
    setMyPlan((prev) => prev.map((row) => (row.id === id ? { ...row, covered } : row)));
    try {
      const res = await fetch(`/api/yearly-plan/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ covered }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setMyPlan((prev) => prev.map((row) => (row.id === id ? { ...row, covered: !covered } : row)));
      showError("Kaydedilemedi, tekrar deneyin.");
    }
  }

  async function downloadYearlyPlanPdf() {
    if (filteredPlan.length === 0) return;
    setDownloadingPlanPdf(true);
    try {
      await fetchAndDownloadPdf(
        "/api/yearly-plan/pdf",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teacherName,
            subject,
            rows: filteredPlan.map((r) => ({ weekLabel: r.weekLabel, subtopicName: r.subtopicName, notes: r.notes ?? "" })),
          }),
        },
        `${teacherName}-yillik-plan.pdf`.replace(/\s+/g, "-")
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "PDF oluşturulamadı.");
    } finally {
      setDownloadingPlanPdf(false);
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
            <div className="mb-2 flex flex-col gap-2 sm:flex-row">
              <input
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Bugün işlenen konu / not ekleyin"
                className="flex-1 rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
              />
              <button onClick={addNote} className="flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-espresso px-3 py-2 text-xs font-medium text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500">
                <Plus className="h-3.5 w-3.5" /> Ekle
              </button>
            </div>
            {/* "Zaman ekle" — kullanıcı talebi: not GEÇMİŞ bir tarih/saate
                ait olarak girilebilsin. Boş bırakılırsa (varsayılan) "şimdi"
                kullanılır — eski davranış aynen korunur. */}
            <div className="mb-4 flex items-center gap-2">
              <input
                type="datetime-local"
                value={noteDateDraft}
                onChange={(event) => setNoteDateDraft(event.target.value)}
                className="rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
              />
              <span className="text-[10.5px] text-espresso-muted dark:text-cream/40">
                {noteDateDraft ? "bu tarih/saatle kaydedilecek" : "boş bırakılırsa şimdi kaydedilir"}
              </span>
            </div>
            <div className="space-y-2">
              {notes.map((note) => (
                <motion.div key={note.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
                  <p className="text-sm text-espresso dark:text-cream">{note.note}</p>
                  <p className="mt-0.5 text-[10px] text-espresso-muted dark:text-cream/40">{new Date(note.noteDate ?? note.createdAt).toLocaleString("tr-TR")}</p>
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
              onClick={downloadYearlyPlanPdf}
              disabled={filteredPlan.length === 0 || downloadingPlanPdf}
              className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso transition hover:bg-cream-card disabled:opacity-50 dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
            >
              {downloadingPlanPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} PDF Çıktı Al
            </button>
          </div>

          {/* Sınıf seviyesi başına ayrı plan — kullanıcı bulgusu: 6/7/8'e
              giren bir öğretmenin TEK ortak planı vardı. Birden fazla sınıf
              seviyesi yoksa bu seçici zaten anlamsız, gösterilmez. */}
          {grades.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <button
                onClick={() => setPlanGradeFilter("Tümü")}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                  planGradeFilter === "Tümü" ? "border-brand-600 bg-brand-600 text-white" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/40"
                )}
              >
                Tüm Sınıflar
              </button>
              {grades.map((grade) => (
                <button
                  key={grade}
                  onClick={() => setPlanGradeFilter(grade)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                    planGradeFilter === grade ? "border-brand-600 bg-brand-600 text-white" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/40"
                  )}
                >
                  {grade}. Sınıf
                </button>
              ))}
            </div>
          )}

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
            {filteredPlan.map((row) => (
              <div key={row.id} className="rounded-xl bg-cream-card px-3 py-2 text-xs dark:bg-white/5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleCovered(row.id, !row.covered)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    title={row.covered ? "İşlendi — kaldırmak için tıkla" : "İşlenmedi — işaretlemek için tıkla"}
                  >
                    {row.covered ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-espresso-muted dark:text-cream/30" />
                    )}
                    <span className="truncate font-medium text-espresso dark:text-cream">{row.weekLabel}</span>
                  </button>
                  <span className="shrink-0 text-espresso-muted dark:text-cream/40">{row.subtopicName}</span>
                </div>
                {/* Kullanıcı bulgusu: not alanı VARDI ama listede hiç
                    render edilmiyordu (sadece PDF'e gidiyordu). */}
                {row.notes && <p className="mt-1 pl-5 text-[10.5px] italic text-espresso-muted dark:text-cream/40">{row.notes}</p>}
              </div>
            ))}
            {filteredPlan.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz plan satırı eklenmedi.</p>}
          </div>
        </motion.div>
      )}
    </div>
  );
}
