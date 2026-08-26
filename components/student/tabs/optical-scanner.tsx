"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CheckCircle2, XCircle, PlayCircle, RotateCcw, ScanLine } from "lucide-react";
import { QUESTION_POOL } from "@/lib/mock-data";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

// Video Çözüm Mimarisi: her yanlış soru, gerçek altyapıda bir HLS/S3/Unlisted
// YouTube 'embedId' taşır. Burada gerçek bir video kaynağı olmadığı için
// (ve sahte bir dış URL uydurmamak için) sadece veri-güdümlü bir "player
// arayüzü" mock'u gösteriyoruz — mimari, gerçek bir video kaynağı bağlanınca
// değişmeden çalışır.
type ScanResult = { id: string; topic: string; questionText: string; isCorrect: boolean; embedId: string; durationLabel: string; steps: string[] };

function buildScanResults(): ScanResult[] {
  return QUESTION_POOL.map((q, i) => ({
    id: q.id,
    topic: q.topic,
    questionText: q.questionText,
    isCorrect: i % 3 !== 0,
    embedId: `demo-cozum-${q.id}`,
    durationLabel: "4:12",
    steps: [
      `${q.topic} konusundaki temel kuralı hatırla.`,
      "Verilen değerleri formülde yerine koy.",
      "İşlemi adım adım sadeleştirip sonucu kontrol et.",
    ],
  }));
}

type Stage = "idle" | "scanning" | "result";

function CameraViewport({ onDone }: { onDone: () => void }) {
  const [scanning, setScanning] = useState(false);

  function startScan() {
    setScanning(true);
    setTimeout(onDone, 1400);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex flex-col bg-black">
      <div className="flex shrink-0 items-center justify-between px-4 pt-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white">Optik cevap kağıdını çerçeveye hizala</span>
      </div>
      <div className="relative m-4 flex flex-1 items-center justify-center overflow-hidden rounded-3xl bg-espresso">
        <div className="absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-brand-500" />
        <div className="absolute right-4 top-4 h-6 w-6 border-r-2 border-t-2 border-brand-500" />
        <div className="absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-brand-500" />
        <div className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-brand-500" />
        {scanning ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2">
            <motion.span animate={{ y: [0, 120, 0] }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} className="h-0.5 w-40 bg-brand-500" />
            <p className="text-xs text-cream/60">Taranıyor...</p>
          </motion.div>
        ) : (
          <ScanLine className="h-10 w-10 text-cream/30" />
        )}
      </div>
      <div className="shrink-0 px-6 pb-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
        <button
          onClick={startScan}
          disabled={scanning}
          className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-70"
        >
          <Camera className="h-5 w-5" /> {scanning ? "Analiz ediliyor..." : "Tara ve Analiz Et"}
        </button>
      </div>
    </motion.div>
  );
}

function VideoSolutionModal({ result, onClose }: { result: ScanResult | null; onClose: () => void }) {
  return (
    <Modal isOpen={!!result} onClose={onClose} title="Çözüm Videosu">
      {result && (
        <div className="space-y-3">
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-espresso">
            <button className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25">
              <PlayCircle className="h-9 w-9" />
            </button>
            <span className="absolute bottom-2 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">{result.durationLabel}</span>
            <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] text-white/70">demo önizleme</span>
          </div>
          <p className="text-xs font-semibold text-espresso dark:text-cream">{result.topic} — {result.questionText}</p>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Çözüm Adımları</p>
            <ol className="space-y-1.5">
              {result.steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-xs text-espresso-muted dark:text-cream/50">
                  <span className="shrink-0 font-semibold text-brand-600">{i + 1}.</span> {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function OpticalScannerTab() {
  const [stage, setStage] = useState<Stage>("idle");
  const [results, setResults] = useState<ScanResult[]>([]);
  const [selected, setSelected] = useState<ScanResult | null>(null);

  function finishScan() {
    setResults(buildScanResults());
    setStage("result");
  }

  const correctCount = results.filter((r) => r.isCorrect).length;
  const wrongCount = results.length - correctCount;

  return (
    <div className="space-y-4">
      {stage === "idle" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3 rounded-3xl border border-hairline bg-white/70 p-8 text-center backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
          <ScanLine className="h-10 w-10 text-brand-600" />
          <p className="text-sm font-semibold text-espresso dark:text-cream">Optik Cevap Kağıdını Tara</p>
          <p className="text-xs text-espresso-muted dark:text-cream/40">Kamerayı kullanarak cevap kağıdını anında analiz et.</p>
          <button
            onClick={() => setStage("scanning")}
            className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso px-6 text-sm font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <Camera className="h-4 w-4" /> Kamerayı Aç
          </button>
        </motion.div>
      )}

      <AnimatePresence>{stage === "scanning" && <CameraViewport onDone={finishScan} />}</AnimatePresence>

      {stage === "result" && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-green-50 p-4 text-center dark:bg-green-500/10">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{correctCount}</p>
              <p className="text-[10px] font-medium text-green-700/70 dark:text-green-400/70">Doğru</p>
            </div>
            <div className="rounded-2xl bg-rose-50 p-4 text-center dark:bg-rose-500/10">
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-300">{wrongCount}</p>
              <p className="text-[10px] font-medium text-rose-600/70 dark:text-rose-300/70">Yanlış</p>
            </div>
          </motion.div>

          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream-card p-3.5 dark:bg-white/5">
                <div className="flex min-w-0 items-center gap-2.5">
                  {r.isCorrect ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> : <XCircle className="h-4 w-4 shrink-0 text-rose-500" />}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-espresso dark:text-cream">{r.topic}</p>
                    <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">{r.questionText}</p>
                  </div>
                </div>
                {!r.isCorrect && (
                  <button
                    onClick={() => setSelected(r)}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1.5 text-[10px] font-semibold text-white"
                  >
                    <PlayCircle className="h-3 w-3" /> Çözüm Videosu
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => setStage("idle")}
            className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-hairline text-xs font-medium text-espresso dark:border-white/10 dark:text-cream"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Yeni Tarama Yap
          </button>
        </>
      )}

      <VideoSolutionModal result={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
