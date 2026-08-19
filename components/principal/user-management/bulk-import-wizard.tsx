"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import {
  Download,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  UserCog2,
  Printer,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { downloadImportTemplate } from "@/lib/bulk-import/template";
import { parseXlsxFile, parseCsvFile } from "@/lib/bulk-import/parse-spreadsheet";
import { parsePdfFile } from "@/lib/bulk-import/parse-pdf";
import { validateRows } from "@/lib/bulk-import/validate";
import type { ImportRole, RawRow, ValidatedRow } from "@/lib/bulk-import/types";
import { BulkCredentialsPrint, type PrintableCredential } from "./bulk-credentials-print";

type RowResult = {
  rowIndex: number;
  fullName: string;
  status: "success" | "failed";
  username?: string;
  password?: string;
  institutionalCode?: string;
  error?: string;
};

const STEPS = ["Şablon İndir", "Dosya Yükle", "Doğrulama", "Kayıt & Çıktı"];

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
                  isDone
                    ? "bg-green-600 text-white"
                    : isActive
                      ? "bg-espresso text-cream dark:bg-brand-600"
                      : "bg-cream-card text-espresso-muted dark:bg-white/10 dark:text-cream/40"
                )}
              >
                {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : stepNum}
              </motion.div>
              <span className={cn("max-w-[64px] text-center text-[9px] leading-tight", isActive ? "font-semibold text-espresso dark:text-cream" : "text-espresso-muted dark:text-cream/40")}>
                {label}
              </span>
            </div>
            {stepNum < STEPS.length && <div className={cn("mx-1 h-0.5 flex-1 rounded-full transition-colors", isDone ? "bg-green-600" : "bg-cream-card dark:bg-white/10")} />}
          </div>
        );
      })}
    </div>
  );
}

export function BulkImportWizard({ isOpen, onClose, onImported }: { isOpen: boolean; onClose: () => void; onImported: () => void }) {
  const { showError } = useToast();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<ImportRole>("STUDENT");
  const [branchNames, setBranchNames] = useState<string[]>([]);

  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);

  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/admin/dashboard?segment=ALL")
      .then((res) => res.json())
      .then((data) => setBranchNames((data.branches ?? []).map((b: { name: string }) => b.name)))
      .catch(() => showError("Şube listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function reset() {
    setStep(1);
    setFileName(null);
    setRawRows([]);
    setValidatedRows([]);
    setResults(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setIsParsing(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let rows: RawRow[] = [];
      if (extension === "csv") rows = await parseCsvFile(file);
      else if (extension === "xlsx" || extension === "xls") rows = await parseXlsxFile(file);
      else if (extension === "pdf") rows = await parsePdfFile(file);
      else throw new Error("Desteklenmeyen dosya türü — .xlsx, .csv veya .pdf yükleyin.");

      if (rows.length === 0) throw new Error("Dosyada okunabilir satır bulunamadı.");

      setRawRows(rows);
      setValidatedRows(validateRows(role, rows, branchNames));
      setStep(3);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Dosya ayrıştırılamadı.");
      setFileName(null);
    } finally {
      setIsParsing(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const validCount = validatedRows.filter((r) => r.isValid).length;
  const invalidCount = validatedRows.length - validCount;

  async function handleImport() {
    const validRawRows = validatedRows.filter((r) => r.isValid).map((r) => r.raw);
    if (validRawRows.length === 0) return;
    setIsImporting(true);
    setStep(4);
    try {
      const res = await fetch("/api/admin/import/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, rows: validRawRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "İçe aktarma başarısız.");
      setResults(data.results ?? []);
      onImported();
    } catch (error) {
      showError(error instanceof Error ? error.message : "İçe aktarma başarısız.");
      setStep(3);
    } finally {
      setIsImporting(false);
    }
  }

  function exportResultsToExcel() {
    if (!results) return;
    const successRows = results.filter((r) => r.status === "success");
    const sheet = XLSX.utils.json_to_sheet(
      successRows.map((r) => ({
        "Ad Soyad": r.fullName,
        "Kullanıcı Adı": r.username,
        "Geçici Şifre": r.password,
        ...(role === "TEACHER" ? { "Kurumsal Kod": r.institutionalCode ?? "" } : {}),
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Giriş Bilgileri");
    XLSX.writeFile(workbook, `toplu-giris-bilgileri-${role === "STUDENT" ? "ogrenci" : "ogretmen"}.xlsx`);
  }

  const printableCredentials: PrintableCredential[] = (results ?? [])
    .filter((r) => r.status === "success" && r.username && r.password)
    .map((r) => ({ fullName: r.fullName, username: r.username!, password: r.password!, institutionalCode: r.institutionalCode }));

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title="Toplu İçe Aktarma Sihirbazı">
        <StepIndicator current={step} />

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-4">
              <div className="flex gap-1.5 rounded-xl bg-cream-card p-1 dark:bg-white/5">
                <button
                  onClick={() => setRole("STUDENT")}
                  className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition", role === "STUDENT" ? "bg-espresso text-cream dark:bg-brand-600" : "text-espresso-muted dark:text-cream/40")}
                >
                  <GraduationCap className="h-3.5 w-3.5" /> Öğrenci
                </button>
                <button
                  onClick={() => setRole("TEACHER")}
                  className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition", role === "TEACHER" ? "bg-espresso text-cream dark:bg-brand-600" : "text-espresso-muted dark:text-cream/40")}
                >
                  <UserCog2 className="h-3.5 w-3.5" /> Öğretmen
                </button>
              </div>

              <div className="rounded-2xl border border-hairline bg-cream-card p-4 dark:border-white/10 dark:bg-white/5">
                <p className="mb-1 text-sm font-medium text-espresso dark:text-cream">
                  {role === "STUDENT" ? "Öğrenci" : "Öğretmen"} şablonunu indir
                </p>
                <p className="mb-3 text-xs text-espresso-muted dark:text-cream/40">
                  Şablon, veritabanındaki güncel {branchNames.length} şubeyi referans sayfasında listeler — &quot;Şube&quot; sütununa yazacağınız isim bu listeyle birebir eşleşmelidir.
                </p>
                <button
                  onClick={() => downloadImportTemplate(role, branchNames)}
                  disabled={branchNames.length === 0}
                  className="flex items-center gap-1.5 rounded-lg bg-espresso px-3 py-2 text-xs font-medium text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
                >
                  <Download className="h-3.5 w-3.5" /> Excel Şablonu İndir (.xlsx)
                </button>
              </div>

              <button
                onClick={() => setStep(2)}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                Devam Et <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-4">
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => !isParsing && inputRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                  isDragging ? "border-brand-600 bg-brand-50 dark:bg-brand-600/10" : "border-hairline dark:border-white/10"
                )}
              >
                {isParsing ? (
                  <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                ) : (
                  <motion.div animate={isDragging ? { scale: 1.15 } : { scale: 1 }} className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-600/15">
                    <UploadCloud className="h-6 w-6" />
                  </motion.div>
                )}
                <p className="text-sm font-medium text-espresso dark:text-cream">
                  {isParsing ? "Dosya ayrıştırılıyor..." : fileName ?? "Excel, CSV veya PDF dosyasını buraya sürükleyin"}
                </p>
                <p className="text-xs text-espresso-muted dark:text-cream/40">veya tıklayıp dosya seçin (.xlsx, .csv, .pdf)</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleFile(file);
                    event.target.value = "";
                  }}
                />
              </div>
              <p className="flex items-center gap-1.5 text-[10px] text-espresso-muted dark:text-cream/40">
                <FileText className="h-3 w-3 shrink-0" /> PDF ayrıştırma en iyi çaba (best-effort) prensibiyle çalışır — düzgün hizalanmış basit tablolarda güvenilirdir, sonraki adımda tüm satırlar tekrar doğrulanır.
              </p>
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-xs font-medium text-espresso-muted transition hover:text-espresso dark:text-cream/40 dark:hover:text-cream"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Geri
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-green-50 p-3 text-center dark:bg-green-500/10">
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">{validCount}</p>
                  <p className="text-[10px] text-green-700/70 dark:text-green-400/70">Geçerli Satır</p>
                </div>
                <div className="rounded-xl bg-rose-50 p-3 text-center dark:bg-rose-500/10">
                  <p className="text-lg font-bold text-rose-600 dark:text-rose-300">{invalidCount}</p>
                  <p className="text-[10px] text-rose-600/70 dark:text-rose-300/70">Hatalı Satır</p>
                </div>
              </div>

              <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-hairline p-2 dark:border-white/10">
                {validatedRows.map((row) => (
                  <div
                    key={row.rowIndex}
                    className={cn(
                      "flex items-start gap-2 rounded-lg px-2.5 py-2 text-xs",
                      row.isValid ? "bg-green-50 dark:bg-green-500/10" : "bg-rose-50 dark:bg-rose-500/10"
                    )}
                  >
                    {row.isValid ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-espresso dark:text-cream">
                        Satır {row.rowIndex + 1}: {row.fullName || "(isim yok)"}
                      </p>
                      {!row.isValid && <p className="text-rose-600 dark:text-rose-300">{row.errors.join(" · ")}</p>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex min-h-[48px] items-center gap-1.5 rounded-2xl border border-hairline px-4 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Geri
                </button>
                <button
                  onClick={handleImport}
                  disabled={validCount === 0}
                  className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
                >
                  Geçerli {validCount} Kaydı İçe Aktar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-4">
              {isImporting || !results ? (
                <div className="flex flex-col items-center gap-3 py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                  <p className="text-sm text-espresso-muted dark:text-cream/40">Kayıtlar oluşturuluyor, her satır ayrı ayrı işleniyor...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-green-50 p-3 text-center dark:bg-green-500/10">
                      <p className="text-lg font-bold text-green-700 dark:text-green-400">{results.filter((r) => r.status === "success").length}</p>
                      <p className="text-[10px] text-green-700/70 dark:text-green-400/70">Başarıyla Oluşturuldu</p>
                    </div>
                    <div className="rounded-xl bg-rose-50 p-3 text-center dark:bg-rose-500/10">
                      <p className="text-lg font-bold text-rose-600 dark:text-rose-300">{results.filter((r) => r.status === "failed").length}</p>
                      <p className="text-[10px] text-rose-600/70 dark:text-rose-300/70">Başarısız</p>
                    </div>
                  </div>

                  <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-hairline p-2 dark:border-white/10">
                    {results.map((r) => (
                      <div key={r.rowIndex} className={cn("flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs", r.status === "success" ? "bg-green-50 dark:bg-green-500/10" : "bg-rose-50 dark:bg-rose-500/10")}>
                        <span className="font-medium text-espresso dark:text-cream">{r.fullName}</span>
                        {r.status === "success" ? (
                          <span className="font-mono text-[10px] text-green-700 dark:text-green-400">{r.username}</span>
                        ) : (
                          <span className="text-[10px] text-rose-600 dark:text-rose-300">{r.error}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {printableCredentials.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={exportResultsToExcel}
                        className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-hairline text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel İndir
                      </button>
                      <button
                        onClick={() => setIsPrintOpen(true)}
                        className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-hairline text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
                      >
                        <Printer className="h-3.5 w-3.5" /> Yazdır / PDF
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleClose}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
                  >
                    <X className="h-4 w-4" /> Kapat
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>

      <BulkCredentialsPrint isOpen={isPrintOpen} onClose={() => setIsPrintOpen(false)} role={role} credentials={printableCredentials} />
    </>
  );
}
