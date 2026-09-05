"use client";

import { useEffect, useState } from "react";
import { Loader2, UploadCloud, Settings2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import type { RosterStudent } from "@/lib/exam-import/types";
import { OpticalFormatManager, type OpticalFormat } from "./optical-format-manager";

type PreviewRow = {
  lineNumber: number;
  name: string | null;
  tcNo: string | null;
  studentNo: string | null;
  matchedStudentId: string | null;
  matchStatus: "matched" | "ambiguous" | "unmatched";
  candidates: { id: string; firstName: string; lastName: string }[];
  net: number;
  correctCount: number;
  wrongQuestionNumbers: number[];
  blankQuestionNumbers: number[];
};

const STATUS_STYLE: Record<PreviewRow["matchStatus"], { icon: typeof CheckCircle2; className: string; label: string }> = {
  matched: { icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400", label: "Eşleşti" },
  ambiguous: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400", label: "Birden fazla aday" },
  unmatched: { icon: XCircle, className: "text-rose-500", label: "Eşleşmedi" },
};

// Optik (OMR tarayıcı) yükleme — sabit-genişlikli .txt dosyasını (bkz.
// lib/server/exams/optical-import.ts) tanımlı bir OpticalFormat'a göre
// ayrıştırır, cevap anahtarındaki (ExamQuestion.correctAnswer) doğru
// cevaplarla karşılaştırıp önizler; admin eşleşmeleri gözden geçirip
// onaylayınca AYNI toplu yazma yolundan (bulkUpsertExamNetResults, bkz.
// confirm route) kaydeder — PDF sihirbazıyla AYNI "önce önizle, sonra
// kaydet" felsefesi.
export function OpticalUploadSection({
  examId,
  subject,
  roster,
  onSaved,
}: {
  examId: string;
  subject: string;
  roster: RosterStudent[] | null;
  onSaved: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [formats, setFormats] = useState<OpticalFormat[] | null>(null);
  const [formatId, setFormatId] = useState("");
  const [rawText, setRawText] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [managerOpen, setManagerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function loadFormats() {
    fetch("/api/optical-formats")
      .then((res) => res.json())
      .then((data) => {
        const list: OpticalFormat[] = data.formats ?? [];
        setFormats(list);
        setFormatId((prev) => (prev && list.some((f) => f.id === prev) ? prev : (list[0]?.id ?? "")));
      })
      .catch(() => showError("Optik formatlar yüklenemedi."));
  }

  useEffect(() => {
    loadFormats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeFormat = formats?.find((f) => f.id === formatId) ?? null;
  const formatSupportsSubject = activeFormat?.subjectBlocks.some((b) => b.subject === subject) ?? false;

  async function handleFile(file: File) {
    const text = await file.text();
    setRawText(text);
  }

  async function preview() {
    if (!formatId) return showError("Önce bir optik format seç.");
    if (!rawText.trim()) return showError("Optik metin dosyasını yapıştır veya yükle.");
    setPreviewing(true);
    setRows(null);
    setOverrides({});
    try {
      const res = await fetch(`/api/exams/${examId}/optical-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formatId, subject, rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Önizleme oluşturulamadı.");
      setRows(data.rows ?? []);
      showSuccess(`${data.totalLines} satır okundu, ${data.matchedCount} öğrenci otomatik eşleşti.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Önizleme oluşturulamadı.");
    } finally {
      setPreviewing(false);
    }
  }

  function resolvedStudentId(row: PreviewRow): string | null {
    return overrides[row.lineNumber] ?? row.matchedStudentId;
  }

  async function confirm() {
    if (!rows) return;
    const payload = rows
      .map((r) => ({ studentId: resolvedStudentId(r), net: r.net, wrongQuestionNumbers: r.wrongQuestionNumbers, blankQuestionNumbers: r.blankQuestionNumbers }))
      .filter((r): r is { studentId: string; net: number; wrongQuestionNumbers: number[]; blankQuestionNumbers: number[] } => !!r.studentId);
    if (payload.length === 0) return showError("Kaydedilecek eşleşmiş satır yok — önce eşleşmeyen öğrencileri elle seç.");
    setSaving(true);
    try {
      const res = await fetch(`/api/exams/${examId}/optical-upload/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, rows: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      showSuccess(`${data.successCount} öğrencinin optik sonucu kaydedildi.`);
      setRows(null);
      setRawText("");
      onSaved();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-espresso dark:text-cream">3. Optik Okuma — Tarayıcı Dosyasını Yükle</p>
        <button
          onClick={() => setManagerOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1 text-[11px] font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
        >
          <Settings2 className="h-3 w-3" /> Formatları Yönet
        </button>
      </div>

      {formats === null ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : formats.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline py-6 text-center text-[11px] text-espresso-muted dark:border-white/10 dark:text-cream/40">
          Henüz bir optik format tanımlanmadı — tarayıcının ürettiği .txt dosyasının sütun düzenini tanımlamak için &quot;Formatları Yönet&quot;e bas.
        </p>
      ) : (
        <div className="space-y-3">
          <select
            value={formatId}
            onChange={(e) => setFormatId(e.target.value)}
            className="w-full rounded-lg border border-hairline bg-white px-2.5 py-2 text-xs text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          >
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          {activeFormat && !formatSupportsSubject && (
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-300">
              &quot;{activeFormat.name}&quot; formatında &quot;{subject}&quot; dersinin sütun aralığı tanımlı değil — Formatları Yönet&apos;ten ekle.
            </p>
          )}

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Optik tarayıcının ürettiği .txt dosyasının içeriğini buraya yapıştır…"
            rows={5}
            className="w-full resize-y rounded-lg border border-hairline bg-white px-3 py-2 font-mono text-[10.5px] leading-relaxed text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-[11px] font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5">
              <UploadCloud className="h-3.5 w-3.5" /> .txt Dosyası Seç
              <input type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
            <button
              onClick={preview}
              disabled={previewing || !formatSupportsSubject}
              className="ml-auto flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {previewing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Önizle
            </button>
          </div>
        </div>
      )}

      {rows && (
        <div className="mt-4 space-y-2">
          <div className="max-h-80 overflow-y-auto rounded-xl border border-hairline dark:border-white/10">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-cream-card text-left text-[10px] uppercase tracking-wide text-espresso-muted dark:bg-white/5 dark:text-cream/40">
                <tr>
                  <th className="px-2 py-1.5">Satır</th>
                  <th className="px-2 py-1.5">Ad Soyad / T.C.</th>
                  <th className="px-2 py-1.5">Eşleşme</th>
                  <th className="px-2 py-1.5">Net</th>
                  <th className="px-2 py-1.5">D/Y/B</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = STATUS_STYLE[row.matchStatus];
                  const StatusIcon = status.icon;
                  const candidateList = row.matchStatus === "ambiguous" ? row.candidates : roster ?? [];
                  return (
                    <tr key={row.lineNumber} className="border-t border-hairline dark:border-white/10">
                      <td className="px-2 py-1.5 text-espresso-muted dark:text-cream/40">{row.lineNumber}</td>
                      <td className="px-2 py-1.5">
                        <span className="block font-medium text-espresso dark:text-cream">{row.name ?? "—"}</span>
                        <span className="block text-[10px] text-espresso-muted dark:text-cream/40">{row.tcNo ?? row.studentNo ?? ""}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        {row.matchStatus === "matched" ? (
                          <span className={cn("flex items-center gap-1", status.className)}>
                            <StatusIcon className="h-3 w-3" /> {status.label}
                          </span>
                        ) : (
                          <select
                            value={overrides[row.lineNumber] ?? ""}
                            onChange={(e) => setOverrides((prev) => ({ ...prev, [row.lineNumber]: e.target.value }))}
                            className={cn(
                              "rounded border bg-white px-1.5 py-1 text-[10.5px] outline-none dark:bg-midnight dark:text-cream",
                              overrides[row.lineNumber] ? "border-emerald-500/40" : "border-amber-500/30"
                            )}
                          >
                            <option value="">{status.label} — seç</option>
                            {candidateList.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.firstName} {c.lastName}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-1.5 font-semibold tabular-nums text-espresso dark:text-cream">{row.net}</td>
                      <td className="px-2 py-1.5 tabular-nums text-espresso-muted dark:text-cream/40">
                        {row.correctCount}/{row.wrongQuestionNumbers.length}/{row.blankQuestionNumbers.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            onClick={confirm}
            disabled={saving}
            className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Onayla ve Kaydet
          </button>
        </div>
      )}

      <OpticalFormatManager isOpen={managerOpen} onClose={() => setManagerOpen(false)} onSaved={loadFormats} />
    </div>
  );
}
