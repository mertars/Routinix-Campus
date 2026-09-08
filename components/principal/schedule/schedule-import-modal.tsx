"use client";

import { useState } from "react";
import { Loader2, Upload, Download, CheckCircle2, AlertTriangle, FileSpreadsheet, ArrowRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { runChunked, DEFAULT_CHUNK_SIZE, type ChunkProgress } from "@/lib/client/chunked-import";

type RowResult = {
  rowIndex: number;
  branchName: string;
  teacherName: string;
  day: string;
  slot: string;
  subject: string;
  status: "ok" | "failed";
  error?: string;
  overwrites?: string;
};

type Outcome = { results: RowResult[]; okCount: number; failedCount: number; overwriteCount: number };

// CSV ayrıştırıcı — noktalı virgül VEYA virgül ayraçlı, tırnaklı
// hücreleri destekler. Excel Türkçe yerelde noktalı virgülle kaydeder,
// başka araçlar virgülle; müdüre "hangisi?" diye sormak yerine ikisini
// de kabul ediyoruz.
function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (!clean) return [];
  const lines = clean.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) return [];

  const delimiter = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        // "" → kaçırılmış tırnak
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };

  const header = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      // Başlıktaki açıklama parantezi ("Ders (boşsa...)") anahtarı
      // bozmasın.
      const key = h.split("(")[0].trim();
      row[key] = cells[i] ?? "";
    });
    return row;
  });
}

// Ders programı toplu içe aktarma — İKİ AŞAMALI.
//
// Önce KONTROL: hiçbir şey yazılmadan her satır doğrulanır, hangisi
// neden geçmiyor ve hangisi mevcut dersin üzerine yazacak gösterilir.
// Müdür 120 satırlık bir dosyayı körlemesine uygulamak zorunda kalmasın.
export function ScheduleImportModal({
  isOpen,
  onClose,
  onImported,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ChunkProgress>({ done: 0, total: 0, percent: 0 });

  function reset() {
    setRows([]);
    setFileName("");
    setOutcome(null);
  }

  async function onFile(file: File) {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      showError("Dosyada satır bulunamadı. Şablonu indirip üzerine yazmayı deneyin.");
      return;
    }
    setFileName(file.name);
    setRows(parsed);
    setOutcome(null);
  }

  async function run(dryRun: boolean) {
    setBusy(true);
    setProgress({ done: 0, total: rows.length, percent: 0 });
    try {
      // ⚠️ KONTROL aşaması parçalanmaz: çakışma denetimi dosyanın
      // TAMAMINA bakmak zorunda (aynı öğretmeni aynı saatte iki şubeye
      // yazan iki satır ayrı parçalara düşerse çakışma görünmez).
      // Yalnızca UYGULAMA parçalanır — orada satırlar zaten doğrulanmış.
      const send = async (chunk: Record<string, string>[]) => {
        const res = await fetch("/api/lesson-slots/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunk, dryRun }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d?.error);
        return [d as Outcome];
      };

      if (dryRun) {
        const [d] = await send(rows);
        setOutcome(d);
      } else {
        const parts = await runChunked(rows, DEFAULT_CHUNK_SIZE, send, setProgress);
        const merged: Outcome = {
          results: parts.flatMap((p) => p.results),
          okCount: parts.reduce((s, p) => s + p.okCount, 0),
          failedCount: parts.reduce((s, p) => s + p.failedCount, 0),
          overwriteCount: parts.reduce((s, p) => s + p.overwriteCount, 0),
        };
        setOutcome(merged);
        showSuccess(`${merged.okCount} ders programa işlendi.`);
        onImported();
      }
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  }

  const checked = outcome !== null;
  const applied = checked && outcome.results.length > 0 && !busy;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Ders Programı İçe Aktar"
      widthClassName="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-hairline bg-cream-card/50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="mb-2 text-xs text-espresso dark:text-cream">
            <strong>1. Şablonu indirin.</strong> Kurumunuzun şubeleri, günleri ve saatleriyle önceden doldurulmuş gelir;
            siz yalnızca <strong>Öğretmen</strong> sütununu yazarsınız. Ders sütunu boşsa öğretmenin branşı kullanılır.
          </p>
          <a
            href="/api/lesson-slots/template"
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            <Download className="h-3.5 w-3.5" /> Şablonu İndir (CSV)
          </a>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-espresso dark:text-cream">2. Doldurduğunuz dosyayı seçin</p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-hairline py-6 text-xs text-espresso-muted transition hover:bg-cream-card dark:border-white/15 dark:text-cream/40 dark:hover:bg-white/5">
            <FileSpreadsheet className="h-4 w-4" />
            {fileName ? `${fileName} · ${rows.length} satır` : "CSV dosyası seç"}
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {rows.length > 0 && !checked && (
          <button
            onClick={() => run(true)}
            disabled={busy}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-brand-600/40 bg-brand-600/10 text-sm font-semibold text-brand-700 transition hover:bg-brand-600/20 disabled:opacity-50 dark:text-brand-500"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            3. Kontrol Et ({rows.length} satır) — hiçbir şey yazılmaz
          </button>
        )}

        {checked && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Geçerli" value={outcome.okCount} tone="green" />
              <Stat label="Hatalı" value={outcome.failedCount} tone="rose" />
              <Stat label="Üzerine yazacak" value={outcome.overwriteCount} tone="amber" />
            </div>

            <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-hairline p-2 dark:border-white/10">
              {outcome.results.map((r) => (
                <div
                  key={r.rowIndex}
                  className={cn(
                    "flex items-start gap-2 rounded-lg px-2 py-1.5 text-[11px]",
                    r.status === "failed"
                      ? "bg-rose-500/5 text-rose-800 dark:text-rose-300"
                      : r.overwrites
                        ? "bg-amber-500/5 text-amber-800 dark:text-amber-300"
                        : "text-espresso-muted dark:text-cream/50"
                  )}
                >
                  <span className="w-8 shrink-0 tabular-nums opacity-60">#{r.rowIndex + 1}</span>
                  <span className="flex-1">
                    {r.status === "failed" ? (
                      r.error
                    ) : r.overwrites ? (
                      <>
                        {r.branchName} · {r.day} {r.slot} — <strong>{r.overwrites}</strong> yerine {r.teacherName}
                      </>
                    ) : (
                      <>
                        {r.branchName} · {r.day} {r.slot} → {r.teacherName} ({r.subject})
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {outcome.failedCount > 0 && (
              <p className="flex items-start gap-1.5 text-[11px] text-espresso-muted dark:text-cream/40">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Hatalı satırlar atlanır, geçerli olanlar uygulanır. Dosyayı düzeltip yeniden yüklemek isterseniz bu
                pencereyi kapatmanız yeterli.
              </p>
            )}

            {busy && progress.total > 0 && (
              <div>
                <div className="mb-1 flex justify-between text-[11px] text-espresso-muted dark:text-cream/40">
                  <span>{progress.done} / {progress.total} satır işlendi</span>
                  <span>%{progress.percent}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
                  <div className="h-full rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${progress.percent}%` }} />
                </div>
              </div>
            )}

            <button
              onClick={() => run(false)}
              disabled={busy || outcome.okCount === 0 || !applied}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              4. {outcome.okCount} Dersi Programa İşle <ArrowRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "green" | "rose" | "amber" }) {
  const toneClass = {
    green: "text-green-700 dark:text-green-400",
    rose: "text-rose-700 dark:text-rose-400",
    amber: "text-amber-700 dark:text-amber-400",
  }[tone];
  return (
    <div className="rounded-xl border border-hairline p-2.5 text-center dark:border-white/10">
      <p className={cn("text-lg font-bold", toneClass)}>{value}</p>
      <p className="text-[10px] text-espresso-muted dark:text-cream/40">{label}</p>
    </div>
  );
}
