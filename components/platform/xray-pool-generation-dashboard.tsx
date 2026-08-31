"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pause, Play, Database, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type SubtopicProgress = {
  subtopicId: string;
  subtopicName: string;
  topicName: string;
  grade: number;
  roundsSuccess: number;
  roundsFailed: number;
  questionCount: number;
};

type StatusResponse = {
  control: { paused: boolean; dailyTokenBudget: number; tokensUsedToday: number; tokensUsedTotal: number; budgetResetAt: string };
  subtopics: SubtopicProgress[];
  totals: { questionCount: number; roundsSuccess: number; roundsFailed: number };
};

const TARGET_ROUNDS = 10;

// Faz Z3 — worker'ın (scripts/xray-generate-question-pool.ts) DB'ye yazdığı
// durumu izleyen SALT OKUNUR panel + Duraklat/Devam Et anahtarı. Worker
// Vercel'de DEĞİL ayrı bir arka plan sürecinde çalıştığı için bu panel onu
// TETİKLEMEZ — sadece durumunu gösterir ve bir sonraki tur öncesi
// okuyacağı paused bayrağını değiştirir.
export function XrayPoolGenerationDashboard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { showError } = useToast();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/xray-pool-generation");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      setData(json);
    } catch {
      showError("Havuz üretim durumu yüklenemedi.");
    }
  }, [showError]);

  useEffect(() => {
    if (!isOpen) return;
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [isOpen, load]);

  async function toggle() {
    if (!data) return;
    setIsToggling(true);
    try {
      const res = await fetch("/api/platform/xray-pool-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: data.control.paused ? "resume" : "pause" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      await load();
    } catch {
      showError("Durum değiştirilemedi.");
    } finally {
      setIsToggling(false);
    }
  }

  const totalTargetRounds = (data?.subtopics.length ?? 0) * TARGET_ROUNDS;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Soru Havuzu Üretim Paneli" variant="center" widthClassName="max-w-3xl">
      {!data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-cream-card p-3 text-center dark:bg-white/5">
              <p className="text-lg font-bold text-espresso dark:text-cream">{data.totals.questionCount.toLocaleString("tr-TR")}</p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Toplam Soru</p>
            </div>
            <div className="rounded-xl bg-cream-card p-3 text-center dark:bg-white/5">
              <p className="text-lg font-bold text-espresso dark:text-cream">
                {data.totals.roundsSuccess}/{totalTargetRounds}
              </p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Başarılı Tur</p>
            </div>
            <div className="rounded-xl bg-cream-card p-3 text-center dark:bg-white/5">
              <p className={cn("text-lg font-bold", data.totals.roundsFailed > 0 ? "text-rose-600 dark:text-rose-400" : "text-espresso dark:text-cream")}>{data.totals.roundsFailed}</p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Başarısız Tur</p>
            </div>
            <div className="rounded-xl bg-cream-card p-3 text-center dark:bg-white/5">
              <p className="text-lg font-bold text-espresso dark:text-cream">
                {(data.control.tokensUsedToday / 1_000_000).toFixed(1)}M/{(data.control.dailyTokenBudget / 1_000_000).toFixed(0)}M
              </p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Bugünkü Token</p>
            </div>
          </div>

          <button
            onClick={toggle}
            disabled={isToggling}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-60",
              data.control.paused ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300",
            )}
          >
            {isToggling ? <Loader2 className="h-4 w-4 animate-spin" /> : data.control.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {data.control.paused ? "Worker Duraklatılmış — Devam Ettir" : "Worker Çalışıyor — Duraklat"}
          </button>

          <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
            {data.subtopics.map((s) => {
              const pct = Math.round((s.roundsSuccess / TARGET_ROUNDS) * 100);
              return (
                <div key={s.subtopicId} className="rounded-lg border border-hairline bg-white/50 px-3 py-2 dark:border-white/10 dark:bg-midnight-card/40">
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-espresso dark:text-cream">
                      <span className="text-espresso-muted dark:text-cream/40">
                        {s.grade}.{s.topicName} ›{" "}
                      </span>
                      {s.subtopicName}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-espresso-muted dark:text-cream/40">
                      {s.roundsFailed > 0 && <AlertTriangle className="h-3 w-3 text-rose-500" />}
                      <Database className="h-3 w-3" /> {s.questionCount}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
                    <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
