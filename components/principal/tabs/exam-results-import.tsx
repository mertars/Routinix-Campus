"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileUp,
  PencilLine,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { extractPdfGrid } from "@/lib/exam-import/extract-pdf-grid";
import { matchAllRows } from "@/lib/exam-import/matching";
import { buildNetResultRows } from "@/lib/exam-import/build-net-rows";
import type { ColumnRole, GridRow, RosterStudent } from "@/lib/exam-import/types";

type Exam = { id: string; name: string; examDate: string };
type Method = "pdf" | "manual";

const STEPS = ["Sınav", "Yöntem", "Önizleme", "Sütun Eşleme", "Eşleştirme", "Kaydet"];

function newId() {
  return Math.random().toString(36).slice(2);
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-5 flex items-center">
      {STEPS.map((label, index) => {
        const stepNum = index + 1;
        const isDone = stepNum < current;
        const isActive = stepNum === current;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <motion.div
                animate={{ scale: isActive ? 1.1 : 1 }}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                  isDone ? "bg-green-600 text-white" : isActive ? "bg-brand-600 text-white" : "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/40"
                )}
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
              </motion.div>
              <span className={cn("hidden text-[9px] font-medium sm:block", isActive ? "text-espresso dark:text-cream" : "text-espresso-muted dark:text-cream/40")}>{label}</span>
            </div>
            {index < STEPS.length - 1 && <div className={cn("mx-1.5 h-0.5 flex-1 rounded-full transition-colors", isDone ? "bg-green-600" : "bg-cream-card dark:bg-white/5")} />}
          </div>
        );
      })}
    </div>
  );
}

const ROLE_LABEL: Record<ColumnRole["kind"], string> = {
  IGNORE: "Yoksay",
  NAME: "Ad Soyad",
  NATIONAL_ID: "T.C. / Öğrenci No",
  BRANCH: "Şube",
  SUBJECT: "Ders",
};

function columnPreview(grid: GridRow[], colIndex: number): string {
  const values = grid
    .slice(0, 3)
    .map((r) => r.cells[colIndex]?.trim())
    .filter(Boolean);
  return values.length > 0 ? values.join(" · ") : "(boş)";
}

export function ExamResultsImportTab() {
  const { showError, showSuccess } = useToast();
  const [step, setStep] = useState(1);

  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [newExamName, setNewExamName] = useState("");
  const [loadingExams, setLoadingExams] = useState(true);

  const [method, setMethod] = useState<Method | null>(null);
  const [grid, setGrid] = useState<GridRow[]>([]);
  const [columnRoles, setColumnRoles] = useState<ColumnRole[]>([]);
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ successCount: number; failedCount: number } | null>(null);

  useEffect(() => {
    fetch("/api/exams")
      .then((res) => res.json())
      .then((data) => setExams(data.exams ?? []))
      .catch(() => showError("Sınav listesi yüklenemedi."))
      .finally(() => setLoadingExams(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createExam() {
    if (!newExamName.trim()) return;
    try {
      const res = await fetch("/api/exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newExamName.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sınav oluşturulamadı.");
      setExams((prev) => [data.exam, ...prev]);
      setExamId(data.exam.id);
      setNewExamName("");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Sınav oluşturulamadı.");
    }
  }

  async function loadRoster(): Promise<RosterStudent[]> {
    const res = await fetch(`/api/exams/${examId}/roster`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Öğrenci listesi yüklenemedi.");
    const students: RosterStudent[] = data.students ?? [];
    setRoster(students);
    return students;
  }

  async function handlePdfFile(file: File) {
    setIsProcessing(true);
    try {
      const [{ grid: rawGrid, warnings }] = await Promise.all([extractPdfGrid(file), loadRoster()]);
      if (rawGrid.length === 0) {
        showError("PDF'ten okunabilir bir tablo çıkarılamadı — taranmış (görüntü) bir PDF olabilir.");
        return;
      }
      setExtractWarnings(warnings);
      const colCount = Math.max(...rawGrid.map((r) => r.length));
      const rows: GridRow[] = rawGrid.map((r) => ({
        id: newId(),
        cells: [...r, ...new Array(Math.max(0, colCount - r.length)).fill("")],
        matchedStudentId: null,
        matchStatus: "unmatched",
        ambiguousCandidates: [],
      }));
      setGrid(rows);
      setColumnRoles(new Array(colCount).fill(null).map(() => ({ kind: "IGNORE" }) as ColumnRole));
      setMethod("pdf");
      setStep(3);
    } catch (error) {
      showError(error instanceof Error ? error.message : "PDF ayrıştırılamadı.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function startManualEntry() {
    setIsProcessing(true);
    try {
      const students = await loadRoster();
      if (students.length === 0) {
        showError("Bu kurumda kayıtlı öğrenci bulunamadı.");
        return;
      }
      const rows: GridRow[] = students.map((s) => ({
        id: newId(),
        cells: [`${s.firstName} ${s.lastName}`, s.branchName],
        matchedStudentId: s.id,
        matchStatus: "matched",
        ambiguousCandidates: [],
      }));
      setGrid(rows);
      setColumnRoles([{ kind: "NAME" }, { kind: "BRANCH" }]);
      setMethod("manual");
      setStep(3);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Öğrenci listesi yüklenemedi.");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) handlePdfFile(file);
  }

  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) handlePdfFile(file);
    event.target.value = "";
  }

  function updateCell(rowId: string, colIndex: number, value: string) {
    setGrid((prev) => prev.map((r) => (r.id === rowId ? { ...r, cells: r.cells.map((c, i) => (i === colIndex ? value : c)) } : r)));
  }

  function deleteRow(rowId: string) {
    setGrid((prev) => prev.filter((r) => r.id !== rowId));
  }

  function addColumn() {
    setColumnRoles((prev) => [...prev, { kind: "IGNORE" }]);
    setGrid((prev) => prev.map((r) => ({ ...r, cells: [...r.cells, ""] })));
  }

  function updateColumnRole(index: number, role: ColumnRole) {
    setColumnRoles((prev) => prev.map((r, i) => (i === index ? role : r)));
  }

  function proceedToMatching() {
    if (method === "manual") {
      setStep(6);
      return;
    }
    const hasIdentityColumn = columnRoles.some((r) => r.kind === "NAME" || r.kind === "NATIONAL_ID");
    if (!hasIdentityColumn) {
      showError("En az bir 'Ad Soyad' veya 'T.C./Öğrenci No' sütunu işaretlemelisiniz.");
      return;
    }
    if (!columnRoles.some((r) => r.kind === "SUBJECT")) {
      showError("En az bir ders sütunu işaretlemelisiniz.");
      return;
    }
    setGrid((prev) => matchAllRows(prev, columnRoles, roster));
    setStep(5);
  }

  function setRowMatch(rowId: string, studentId: string) {
    setGrid((prev) => prev.map((r) => (r.id === rowId ? { ...r, matchedStudentId: studentId || null, matchStatus: studentId ? "matched" : "unmatched" } : r)));
  }

  function skipRow(rowId: string) {
    setGrid((prev) => prev.map((r) => (r.id === rowId ? { ...r, matchStatus: "skipped", matchedStudentId: null } : r)));
  }

  const unresolvedCount = grid.filter((r) => r.matchStatus === "unmatched" || r.matchStatus === "ambiguous").length;

  async function handleSave() {
    const { rows, skippedRowCount } = buildNetResultRows(grid, columnRoles);
    if (rows.length === 0) {
      showError("Kaydedilecek geçerli satır yok.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/exams/${examId}/net-results/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, source: method === "manual" ? "manual-grid" : "pdf-import" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      setSaveResult({ successCount: data.successCount, failedCount: data.failedCount });
      showSuccess(`${data.successCount} sonuç kaydedildi.${skippedRowCount > 0 ? ` (${skippedRowCount} satır atlandı)` : ""}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  function resetAll() {
    setStep(1);
    setMethod(null);
    setGrid([]);
    setColumnRoles([]);
    setExtractWarnings([]);
    setSaveResult(null);
  }

  return (
    <motion.div
      whileHover={{ scale: 1.005, y: -2 }}
      className="rounded-3xl border border-hairline bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <h2 className="mb-1 text-sm font-semibold text-espresso dark:text-cream">Deneme Sınavı Sonucu İçe Aktar</h2>
      <p className="mb-4 text-[11px] text-espresso-muted dark:text-cream/40">
        Optik okuma PDF&apos;i yükleyip önizlemede düzeltin, ya da netleri doğrudan öğrenci listesinden elle girin — format sabit olmadığı için hiçbir satır sizin onayınız olmadan kaydedilmez.
      </p>

      <StepIndicator current={step} />

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-4">
            {loadingExams ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
              </div>
            ) : (
              <>
                {exams.length > 0 && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-espresso-muted dark:text-cream/40">Mevcut bir sınava ekle</label>
                    <select
                      value={examId}
                      onChange={(e) => setExamId(e.target.value)}
                      className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                    >
                      <option value="">Seçin…</option>
                      {exams.map((exam) => (
                        <option key={exam.id} value={exam.id}>{exam.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-espresso-muted dark:text-cream/40">Ya da yeni bir sınav oluştur</label>
                  <div className="flex gap-2">
                    <input
                      value={newExamName}
                      onChange={(e) => setNewExamName(e.target.value)}
                      placeholder="Örn. YKS Genel Deneme-6"
                      className="flex-1 rounded-xl border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                    />
                    <button onClick={createExam} disabled={!newExamName.trim()} className="shrink-0 rounded-xl bg-espresso px-4 py-2.5 text-xs font-medium text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500">
                      Oluştur
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setStep(2)}
                  disabled={!examId}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
                >
                  Devam Et <ArrowRight className="h-4 w-4" />
                </button>
              </>
            )}
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center gap-3 py-14">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                <p className="text-xs text-espresso-muted dark:text-cream/40">Hazırlanıyor…</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-hairline px-4 py-10 text-center transition-colors hover:border-brand-500/40 dark:border-white/10"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-600/15">
                    <FileUp className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-espresso dark:text-cream">PDF Yükle</p>
                  <p className="text-[11px] text-espresso-muted dark:text-cream/40">Optik okuma raporunu sürükleyin veya seçin</p>
                  <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={handleSelect} />
                </div>
                <button
                  onClick={startManualEntry}
                  className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-hairline px-4 py-10 text-center transition-colors hover:border-brand-500/40 dark:border-white/10"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-600/15">
                    <PencilLine className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-espresso dark:text-cream">Elle Gir</p>
                  <p className="text-[11px] text-espresso-muted dark:text-cream/40">Gerçek öğrenci listesinden başla</p>
                </button>
              </div>
            )}
            <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-xs font-medium text-espresso-muted transition hover:text-espresso dark:text-cream/40 dark:hover:text-cream">
              <ArrowLeft className="h-3.5 w-3.5" /> Geri
            </button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
            {extractWarnings.length > 0 && (
              <div className="space-y-1.5">
                {extractWarnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-espresso-muted dark:text-cream/40">
              Hücrelere tıklayıp düzeltin, gereksiz satırları (başlık/dipnot vb.) silin.{method === "manual" && " Sağ üstten yeni ders sütunu ekleyebilirsiniz."}
            </p>
            {method === "manual" && (
              <button onClick={addColumn} className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5">
                <Plus className="h-3.5 w-3.5" /> Sütun Ekle
              </button>
            )}
            <div className="long-list max-h-96 overflow-auto rounded-xl border border-hairline dark:border-white/10">
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {grid.map((row) => (
                    <tr key={row.id} className="border-b border-hairline last:border-0 dark:border-white/5">
                      <td className="w-8 border-r border-hairline p-1 dark:border-white/5">
                        <button onClick={() => deleteRow(row.id)} className="flex h-6 w-6 items-center justify-center rounded text-espresso-muted transition hover:bg-rose-50 hover:text-rose-600 dark:text-cream/30 dark:hover:bg-rose-500/10">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                      {row.cells.map((cell, colIndex) => (
                        <td key={colIndex} className="border-r border-hairline p-0 last:border-0 dark:border-white/5">
                          <input
                            value={cell}
                            onChange={(e) => updateCell(row.id, colIndex, e.target.value)}
                            readOnly={method === "manual" && colIndex < 2}
                            className={cn(
                              "w-full min-w-[90px] bg-transparent px-2 py-1.5 text-espresso outline-none focus:bg-brand-50 dark:text-cream dark:focus:bg-brand-600/10",
                              method === "manual" && colIndex < 2 && "text-espresso-muted dark:text-cream/50"
                            )}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-xs font-medium text-espresso-muted transition hover:text-espresso dark:text-cream/40 dark:hover:text-cream">
                <ArrowLeft className="h-3.5 w-3.5" /> Geri
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={grid.length === 0}
                className="flex items-center gap-2 rounded-xl bg-espresso px-4 py-2.5 text-xs font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                Devam Et <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div key="step4" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
            <p className="text-[11px] text-espresso-muted dark:text-cream/40">Her sütunun ne olduğunu işaretleyin. Aynı ders için Doğru+Yanlış VEYA doğrudan Net verebilirsiniz.</p>
            <div className="long-list-compact max-h-96 space-y-2 overflow-y-auto pr-1">
              {columnRoles.map((role, index) => {
                const isFixed = method === "manual" && index < 2;
                return (
                  <div key={index} className="rounded-xl border border-hairline bg-cream-card p-3 dark:border-white/10 dark:bg-white/5">
                    <p className="mb-2 truncate text-[11px] text-espresso-muted dark:text-cream/40">Sütun {index + 1}: {columnPreview(grid, index)}</p>
                    {isFixed ? (
                      <span className="inline-block rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 dark:bg-brand-600/15 dark:text-brand-300">{ROLE_LABEL[role.kind]}</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={role.kind}
                          onChange={(e) => {
                            const kind = e.target.value as ColumnRole["kind"];
                            if (kind === "SUBJECT") updateColumnRole(index, { kind: "SUBJECT", subject: "", metric: "NET" });
                            else updateColumnRole(index, { kind } as ColumnRole);
                          }}
                          className="rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                        >
                          <option value="IGNORE">Yoksay</option>
                          <option value="NAME">Ad Soyad</option>
                          <option value="NATIONAL_ID">T.C. / Öğrenci No</option>
                          <option value="BRANCH">Şube</option>
                          <option value="SUBJECT">Ders</option>
                        </select>
                        {role.kind === "SUBJECT" && (
                          <>
                            <input
                              value={role.subject}
                              onChange={(e) => updateColumnRole(index, { kind: "SUBJECT", subject: e.target.value, metric: role.metric })}
                              placeholder="Ders adı (örn. Matematik)"
                              className="rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                            />
                            <select
                              value={role.metric}
                              onChange={(e) => updateColumnRole(index, { kind: "SUBJECT", subject: role.subject, metric: e.target.value as "DOGRU" | "YANLIS" | "NET" })}
                              className="rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                            >
                              <option value="DOGRU">Doğru</option>
                              <option value="YANLIS">Yanlış</option>
                              <option value="NET">Net (doğrudan)</option>
                            </select>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <button onClick={() => setStep(3)} className="flex items-center gap-1.5 text-xs font-medium text-espresso-muted transition hover:text-espresso dark:text-cream/40 dark:hover:text-cream">
                <ArrowLeft className="h-3.5 w-3.5" /> Geri
              </button>
              <button onClick={proceedToMatching} className="flex items-center gap-2 rounded-xl bg-espresso px-4 py-2.5 text-xs font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500">
                Devam Et <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {step === 5 && (
          <motion.div key="step5" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-green-50 p-3 text-center dark:bg-green-500/10">
                <p className="text-lg font-bold text-green-700 dark:text-green-400">{grid.filter((r) => r.matchStatus === "matched").length}</p>
                <p className="text-[10px] text-green-700/70 dark:text-green-400/70">Eşleşti</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-500/10">
                <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{grid.filter((r) => r.matchStatus === "ambiguous").length}</p>
                <p className="text-[10px] text-amber-700/70 dark:text-amber-400/70">Belirsiz</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-3 text-center dark:bg-rose-500/10">
                <p className="text-lg font-bold text-rose-600 dark:text-rose-300">{grid.filter((r) => r.matchStatus === "unmatched").length}</p>
                <p className="text-[10px] text-rose-600/70 dark:text-rose-300/70">Eşleşmedi</p>
              </div>
            </div>
            <div className="long-list-compact max-h-96 space-y-1.5 overflow-y-auto">
              {grid
                .filter((r) => r.matchStatus !== "skipped")
                .map((row) => {
                  const nameColIndex = columnRoles.findIndex((r) => r.kind === "NAME");
                  const label = nameColIndex >= 0 ? row.cells[nameColIndex] : row.cells.join(" ");
                  const candidates = row.matchStatus === "ambiguous" ? row.ambiguousCandidates : roster;
                  return (
                    <div key={row.id} className={cn("flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs", row.matchStatus === "matched" ? "bg-green-50 dark:bg-green-500/10" : row.matchStatus === "ambiguous" ? "bg-amber-50 dark:bg-amber-500/10" : "bg-rose-50 dark:bg-rose-500/10")}>
                      <span className="min-w-0 flex-1 truncate font-medium text-espresso dark:text-cream">{label || "(isimsiz satır)"}</span>
                      {row.matchStatus === "matched" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                      ) : (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <select
                            value={row.matchedStudentId ?? ""}
                            onChange={(e) => setRowMatch(row.id, e.target.value)}
                            className="rounded-lg border border-hairline bg-white px-2 py-1 text-[11px] text-espresso outline-none dark:border-white/10 dark:bg-midnight dark:text-cream"
                          >
                            <option value="">Öğrenci seç…</option>
                            {candidates.map((s) => (
                              <option key={s.id} value={s.id}>{s.firstName} {s.lastName} · {s.branchName}</option>
                            ))}
                          </select>
                          <button onClick={() => skipRow(row.id)} className="rounded-lg border border-hairline px-2 py-1 text-[11px] text-espresso-muted transition hover:bg-white dark:border-white/10 dark:text-cream/40">
                            Atla
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            <div className="flex items-center justify-between">
              <button onClick={() => setStep(4)} className="flex items-center gap-1.5 text-xs font-medium text-espresso-muted transition hover:text-espresso dark:text-cream/40 dark:hover:text-cream">
                <ArrowLeft className="h-3.5 w-3.5" /> Geri
              </button>
              <button
                onClick={() => setStep(6)}
                disabled={unresolvedCount > 0}
                className="flex items-center gap-2 rounded-xl bg-espresso px-4 py-2.5 text-xs font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                Devam Et <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {step === 6 && (
          <motion.div key="step6" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-4">
            {saveResult ? (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-green-50 p-3 text-center dark:bg-green-500/10">
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">{saveResult.successCount}</p>
                    <p className="text-[10px] text-green-700/70 dark:text-green-400/70">Kaydedildi</p>
                  </div>
                  <div className="rounded-xl bg-rose-50 p-3 text-center dark:bg-rose-500/10">
                    <p className="text-lg font-bold text-rose-600 dark:text-rose-300">{saveResult.failedCount}</p>
                    <p className="text-[10px] text-rose-600/70 dark:text-rose-300/70">Başarısız</p>
                  </div>
                </div>
                <button onClick={resetAll} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-hairline text-sm font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5">
                  <RotateCcw className="h-4 w-4" /> Yeni İçe Aktarma
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-espresso-muted dark:text-cream/40">{grid.filter((r) => r.matchStatus === "matched").length} satır kaydedilmeye hazır. Kaydet&apos;e basınca geri alınamaz (mevcut kayıtlar güncellenir).</p>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  {isSaving ? "Kaydediliyor..." : "Kaydet"}
                </button>
                <button onClick={() => setStep(method === "manual" ? 3 : 5)} className="flex items-center gap-1.5 text-xs font-medium text-espresso-muted transition hover:text-espresso dark:text-cream/40 dark:hover:text-cream">
                  <ArrowLeft className="h-3.5 w-3.5" /> Geri
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
