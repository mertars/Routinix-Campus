"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, UploadCloud, CheckCircle2, AlertTriangle, ChevronDown, Settings2, FileText, Trash2 } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import type { RosterStudent } from "@/lib/exam-import/types";
import { OpticalFormatManager } from "./optical-format-manager";
import { StudentPickerModal } from "./student-picker-modal";
import type { ExamOverview } from "./types";

type PreviewSubjectResult = { subject: string; net: number; correctCount: number; wrongQuestionNumbers: number[]; blankQuestionNumbers: number[] };
type PreviewRow = {
  lineNumber: number;
  name: string | null;
  tcNo: string | null;
  studentNo: string | null;
  matchedStudentId: string | null;
  matchStatus: "matched" | "ambiguous" | "unmatched";
  candidates: { id: string; firstName: string; lastName: string }[];
  subjects: PreviewSubjectResult[];
};

// Sonuç yükleme — optik tarayıcının ürettiği sabit-genişlikli metin
// dosyası BİR KEZ yüklenir, cevap anahtarı girilmiş TÜM dersler aynı
// geçişte puanlanır (kullanıcı kuralı: "hepsini tekte kontrol etmeli").
//
// Önizleme tasarımı bilinçli: 100+ satırlık ham bir tabloyu olduğu gibi
// göstermek yerine ÖNCE özet (kaç eşleşti / kaç sorunlu), sonra SADECE
// sorunlu satırlar açık gelir. Eşleşenler katlanmış durur — çünkü onlar
// için yapılacak bir şey yok.
export function ResultsUploadPanel({
  overview,
  onSaved,
  onFormatChanged,
}: {
  overview: ExamOverview;
  // Sonuçlar kaydedildiğinde — çağıran taraf bunu rapora geçmek için de
  // kullanır, o yüzden şablon düzenlemesiyle KARIŞTIRILMAMALI.
  onSaved: () => void;
  onFormatChanged: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [subjectsScored, setSubjectsScored] = useState<string[]>([]);
  const [subjectsSkipped, setSubjectsSkipped] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roster, setRoster] = useState<RosterStudent[] | null>(null);
  const [pickerLine, setPickerLine] = useState<number | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/exams/${overview.exam.id}/roster`)
      .then((res) => res.json())
      .then((data) => setRoster(data.students ?? []))
      .catch(() => setRoster([]));
  }, [overview.exam.id]);

  const readySubjects = overview.subjects.filter((s) => s.answeredCount > 0);
  const canUpload = !!overview.format && readySubjects.length > 0;

  function resolvedStudentId(row: PreviewRow): string | null {
    return overrides[row.lineNumber] ?? row.matchedStudentId;
  }

  const { resolvedCount, problemRows } = useMemo(() => {
    if (!rows) return { resolvedCount: 0, problemRows: [] as PreviewRow[] };
    const problems = rows.filter((r) => !resolvedStudentId(r));
    return { resolvedCount: rows.length - problems.length, problemRows: problems };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, overrides]);

  async function handleFile(file: File) {
    setRawText(await file.text());
    setFileName(file.name);
  }

  async function preview() {
    if (!overview.exam.opticalFormatId) return showError("Bu denemeye bir optik şablon bağlı değil.");
    if (!rawText.trim()) return showError("Önce optik dosyasını yükle veya yapıştır.");
    setPreviewing(true);
    setRows(null);
    setOverrides({});
    setShowAll(false);
    try {
      const res = await fetch(`/api/exams/${overview.exam.id}/optical-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formatId: overview.exam.opticalFormatId, rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Önizleme oluşturulamadı.");
      setRows(data.rows ?? []);
      setSubjectsScored(data.subjectsScored ?? []);
      setSubjectsSkipped(data.subjectsSkipped ?? []);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Önizleme oluşturulamadı.");
    } finally {
      setPreviewing(false);
    }
  }

  async function save() {
    if (!rows) return;
    const payload = rows
      .map((r) => ({ studentId: resolvedStudentId(r), subjects: r.subjects }))
      .filter((r): r is { studentId: string; subjects: PreviewSubjectResult[] } => !!r.studentId);
    if (payload.length === 0) return showError("Kaydedilecek eşleşmiş satır yok.");
    setSaving(true);
    try {
      const res = await fetch(`/api/exams/${overview.exam.id}/optical-upload/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      showSuccess(`${payload.length} öğrencinin sonucu kaydedildi.`);
      setRows(null);
      setRawText("");
      setFileName(null);
      onSaved();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  if (!canUpload) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline bg-white/40 py-16 text-center dark:border-white/10 dark:bg-white/5">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <p className="text-xs font-semibold text-espresso dark:text-cream">Önce cevap anahtarı gerekli</p>
        <p className="max-w-sm text-[11px] leading-relaxed text-espresso-muted dark:text-cream/40">
          Optik dosyayı puanlayabilmek için en az bir dersin cevap anahtarını girmelisin. &quot;Cevap Anahtarı&quot; adımına dön.
        </p>
      </div>
    );
  }

  const visibleRows = rows ? (showAll ? rows : problemRows) : [];

  return (
    <div className="space-y-4">
      {!rows && (
        <div className="rounded-2xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-espresso dark:text-cream">Optik sonuç dosyası</p>
              <p className="mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">
                {readySubjects.map((s) => s.subject).join(" · ")} puanlanacak
                {overview.subjects.length > readySubjects.length && ` · ${overview.subjects.length - readySubjects.length} ders anahtarsız (atlanır)`}
              </p>
            </div>
            <button
              onClick={() => setManagerOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1 text-[11px] font-medium text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
            >
              <Settings2 className="h-3 w-3" /> Şablon
            </button>
          </div>

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-hairline bg-cream-card/50 py-8 text-center transition hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:border-white/15 dark:bg-white/5">
            <UploadCloud className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11.5px] font-semibold text-espresso dark:text-cream">Dosyayı seç veya sürükle</span>
            <span className="text-[10.5px] text-espresso-muted dark:text-cream/40">.txt — optik tarayıcının çıktısı</span>
            <input type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>

          {fileName && (
            <p className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
              <span className="flex min-w-0 items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{fileName}</span>
                <span className="shrink-0 opacity-70">· {rawText.split(/\r?\n/).filter((l) => l.trim()).length} satır</span>
              </span>
              <button
                onClick={() => {
                  setRawText("");
                  setFileName(null);
                }}
                className="shrink-0 rounded p-1 transition hover:bg-rose-500/10 hover:text-rose-500"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </p>
          )}

          <details className="mt-3 group">
            <summary className="cursor-pointer list-none text-[11px] font-medium text-espresso-muted transition hover:text-espresso dark:text-cream/40 dark:hover:text-cream">
              veya metni doğrudan yapıştır
            </summary>
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setFileName(null);
              }}
              rows={5}
              placeholder="Her satır bir öğrenci…"
              className="mt-2 w-full resize-y rounded-lg border border-hairline bg-white px-3 py-2 font-mono text-[10px] leading-relaxed text-espresso outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </details>

          <button
            onClick={preview}
            disabled={previewing || !rawText.trim()}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-40"
          >
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Oku ve Kontrol Et
          </button>
        </div>
      )}

      {rows && (
        <>
          {/* Özet — önce buna bakılsın */}
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="rounded-2xl border border-hairline bg-white/70 p-3.5 dark:border-white/10 dark:bg-midnight-card/50">
              <p className="text-[10.5px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">Okunan satır</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-espresso dark:text-cream">{rows.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5">
              <p className="text-[10.5px] font-medium uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/60">Eşleşen öğrenci</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{resolvedCount}</p>
            </div>
            <div className={cn("rounded-2xl border p-3.5", problemRows.length > 0 ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-hairline bg-white/70 dark:border-white/10 dark:bg-midnight-card/50")}>
              <p className={cn("text-[10.5px] font-medium uppercase tracking-wide", problemRows.length > 0 ? "text-amber-700/70 dark:text-amber-300/60" : "text-espresso-muted dark:text-cream/40")}>
                Çözüm bekleyen
              </p>
              <p className={cn("mt-1 text-xl font-bold tabular-nums", problemRows.length > 0 ? "text-amber-700 dark:text-amber-300" : "text-espresso dark:text-cream")}>
                {problemRows.length}
              </p>
            </div>
          </div>

          {subjectsSkipped.length > 0 && (
            <p className="flex items-start gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Cevap anahtarı olmadığı için atlanan dersler: {subjectsSkipped.join(", ")}
            </p>
          )}

          {problemRows.length === 0 && !showAll && (
            <p className="flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Bütün satırlar bir öğrenciyle eşleşti — kaydedebilirsin.
            </p>
          )}

          {visibleRows.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-hairline dark:border-white/10">
              <div className="max-h-[26rem] overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 z-10 bg-cream-card text-left text-[9.5px] uppercase tracking-wide text-espresso-muted backdrop-blur dark:bg-midnight-card dark:text-cream/40">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Dosyadaki satır</th>
                      <th className="px-3 py-2 font-semibold">Öğrenci</th>
                      {subjectsScored.map((s) => (
                        <th key={s} className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                          {s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const resolvedId = resolvedStudentId(row);
                      const student = resolvedId ? roster?.find((s) => s.id === resolvedId) ?? null : null;
                      const overridden = !!overrides[row.lineNumber] && overrides[row.lineNumber] !== row.matchedStudentId;
                      return (
                        <tr key={row.lineNumber} className="border-t border-hairline transition hover:bg-cream-card/40 dark:border-white/10 dark:hover:bg-white/[0.03]">
                          <td className="px-3 py-2">
                            <span className="block font-medium text-espresso dark:text-cream">{row.name ?? "(isim yok)"}</span>
                            <span className="block text-[10px] text-espresso-muted dark:text-cream/40">
                              #{row.lineNumber} · {row.tcNo ?? row.studentNo ?? "kimlik yok"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => setPickerLine(row.lineNumber)}
                              className={cn(
                                "flex items-center gap-1 rounded-lg border px-2 py-1 text-left text-[10.5px] font-medium transition hover:brightness-95",
                                student
                                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
                                  : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              )}
                            >
                              {student ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                                  {student.firstName} {student.lastName}
                                  {overridden && <span className="opacity-60">·düzeltildi</span>}
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  Öğrenci seç
                                </>
                              )}
                            </button>
                          </td>
                          {row.subjects.map((s) => (
                            <td key={s.subject} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                              <span className="font-semibold text-espresso dark:text-cream">{s.net}</span>
                              <span className="ml-1 text-[10px] text-espresso-muted dark:text-cream/40">
                                {s.correctCount}·{s.wrongQuestionNumbers.length}·{s.blankQuestionNumbers.length}
                              </span>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAll((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-[11px] font-medium text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")} />
              {showAll ? "Sadece sorunluları göster" : `Tüm ${rows.length} satırı göster`}
            </button>
            <button
              onClick={() => {
                setRows(null);
                setOverrides({});
              }}
              className="rounded-lg border border-hairline px-3 py-2 text-[11px] font-medium text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
            >
              Başka dosya yükle
            </button>
            <button
              onClick={save}
              disabled={saving || resolvedCount === 0}
              className="ml-auto flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {resolvedCount} Öğrenciyi Kaydet
            </button>
          </div>
        </>
      )}

      <OpticalFormatManager isOpen={managerOpen} onClose={() => setManagerOpen(false)} onSaved={onFormatChanged} />

      {pickerLine !== null &&
        (() => {
          const row = rows?.find((r) => r.lineNumber === pickerLine);
          if (!row) return null;
          return (
            <StudentPickerModal
              isOpen
              onClose={() => setPickerLine(null)}
              roster={roster ?? []}
              currentStudentId={resolvedStudentId(row)}
              rowLabel={`${row.name ?? "(isim yok)"} · ${row.tcNo ?? row.studentNo ?? ""}`}
              onSelect={(studentId) => setOverrides((prev) => ({ ...prev, [pickerLine]: studentId }))}
            />
          );
        })()}
    </div>
  );
}
