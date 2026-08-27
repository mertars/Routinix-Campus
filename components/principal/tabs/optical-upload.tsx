"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, CheckCircle2, FileSpreadsheet, Sparkles } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Stage = "idle" | "distributing" | "done";
type BranchAverage = { branchId: string; branchName: string; averageNet: number };

export function OpticalUploadTab() {
  const { showError } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [branchAverages, setBranchAverages] = useState<BranchAverage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function startDistribution(name: string) {
    setFileName(name);
    setStage("distributing");
    try {
      const res = await fetch("/api/admin/optical-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examName: name.replace(/\.(xlsx|xls|csv)$/i, "") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Yükleme başarısız.");
      setBranchAverages(data.branchAverages ?? []);
      setStage("done");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Yükleme başarısız.");
      setStage("idle");
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) startDistribution(file.name);
  }

  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) startDistribution(file.name);
  }

  const maxAverage = Math.max(1, ...branchAverages.map((b) => b.averageNet));

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -3 }}
      className="rounded-3xl border border-hairline bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <h2 className="mb-1 text-sm font-semibold text-espresso dark:text-cream">Yeni Deneme Sınavı Sonucu Yükle</h2>
      <p className="mb-4 text-[11px] text-espresso-muted dark:text-cream/40">
        Gerçek bir Excel/OMR ayrıştırıcı henüz bağlı değil — dosya seçildiğinde her öğrenci için gerçek, kalıcı bir net sonucu üretilip veritabanına yazılır ve şube ortalamaları buradan hesaplanır.
      </p>

      {stage === "idle" && (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors",
            isDragging ? "border-brand-600 bg-brand-50 dark:bg-brand-600/10" : "border-hairline dark:border-white/10"
          )}
        >
          <motion.div
            animate={isDragging ? { scale: 1.15, rotate: 8 } : { scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-600/15"
          >
            <UploadCloud className="h-6 w-6" />
          </motion.div>
          <p className="text-sm font-medium text-espresso dark:text-cream">Excel/CSV deneme sonucunu buraya sürükle</p>
          <p className="text-xs text-espresso-muted dark:text-cream/40">veya tıklayıp dosya seç (.xlsx, .csv)</p>
          <input ref={inputRef} type="file" className="hidden" onChange={handleSelect} accept=".csv,.xlsx,.xls" />
        </div>
      )}

      <AnimatePresence mode="wait">
        {stage !== "idle" && (
          <motion.div key={stage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-brand-600" />
              <span className="flex-1 truncate text-sm text-espresso dark:text-cream">{fileName}</span>
              {stage === "done" && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />}
            </div>

            <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-espresso-muted dark:text-cream/40">
              <Sparkles className="h-3.5 w-3.5 text-brand-600" />
              {stage === "distributing" ? "Sonuçlar şubelere dağıtılıyor..." : "Dağıtım tamamlandı — şube net ortalamaları güncellendi"}
            </p>

            <div className="space-y-3">
              {branchAverages.map((branch, index) => (
                <div key={branch.branchId}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-espresso dark:text-cream/80">{branch.branchName}</span>
                    <span className="text-espresso-muted dark:text-cream/40">{branch.averageNet} net</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-brand-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${(branch.averageNet / maxAverage) * 100}%` }}
                      transition={{ type: "spring", stiffness: 90, damping: 16, delay: index * 0.05 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {stage === "done" && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => {
                  setStage("idle");
                  setFileName(null);
                }}
                className="mt-4 rounded-lg border border-hairline px-4 py-2 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
              >
                Yeni Dosya Yükle
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
