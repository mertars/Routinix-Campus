"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pause, Play, Database, AlertTriangle, PauseCircle, Eye, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

// Kullanıcı geri bildirimi (2026-09-03) — "Yeterlilik" burada YANLIŞ hedefe
// (bu açık uçlu havuz, XrayPracticeQuestion) scaffold edilmişti; gerçek
// niyet "Ne Kadar Anlamış" ekranını beslemekti ama o KİLİTLİ/ÇOKTAN SEÇMELİ
// bir FORMAT (XrayComprehensionQuestion/XrayComprehensionOption) — bu
// worker'ın açık-uçlu blueprint mimarisi onu üretemez. Karışıklık olmasın
// diye buradan kaldırıldı — gerçek üretim ayrı bir prompt+worker gerektirir,
// bkz. app/api/xray/comprehension-topics/route.ts'teki not.
type Variant = "genel" | "alt_konu";

const VARIANT_META: Record<Variant, { label: string; questionCount: number; description: string; implemented: boolean }> = {
  genel: { label: "Genel Konu", questionCount: 30, description: "Temanın tümünü kapsar, tüm alt konulara dağılır", implemented: true },
  alt_konu: { label: "Alt Konu", questionCount: 10, description: "Tek bir alt konuya özel, orta seviye", implemented: true },
};

type UnitRow = { unitId: string; label: string; roundsSuccess: number; roundsFailed: number; questionCount: number };
type VariantSummary = { unitCount: number; targetRounds: number; totalTargetRounds: number; totals: { questionCount: number; roundsSuccess: number; roundsFailed: number } };

type StatusResponse = {
  control: { paused: boolean; activeVariants: Variant[]; dailyTokenBudget: number; tokensUsedToday: number; tokensUsedTotal: number };
  variant: Variant;
  summaries: Record<Variant, VariantSummary>;
  units: UnitRow[];
};

// Faz Z3/Z4 — worker'ın (scripts/xray-generate-question-pool.ts) DB'ye
// yazdığı durumu izleyen SALT OKUNUR panel + variant bazlı Başlat/Durdur.
// Worker Vercel'de DEĞİL ayrı bir arka plan sürecinde çalıştığı için bu
// panel onu TETİKLEMEZ — sadece durumunu gösterir ve worker'ın bir sonraki
// tur öncesi okuyacağı paused/activeVariants alanlarını değiştirir.
export function XrayPoolGenerationDashboard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { showError } = useToast();
  const [selectedVariant, setSelectedVariant] = useState<Variant>("genel");
  const [data, setData] = useState<StatusResponse | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [promptView, setPromptView] = useState<{ systemPrompt: string; userPrompt: string } | null>(null);
  const [isPromptLoading, setIsPromptLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/platform/xray-pool-generation?variant=${selectedVariant}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      setData(json);
    } catch {
      showError("Havuz üretim durumu yüklenemedi.");
    }
  }, [selectedVariant, showError]);

  useEffect(() => {
    if (!isOpen) return;
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [isOpen, load]);

  async function postAction(action: "pause" | "resume", variant?: Variant) {
    setIsToggling(true);
    try {
      const res = await fetch("/api/platform/xray-pool-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, variant }),
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

  async function viewPrompt() {
    if (!data || data.units.length === 0) return;
    setIsPromptLoading(true);
    try {
      const res = await fetch(`/api/platform/xray-pool-generation/prompt?variant=${selectedVariant}&unitId=${encodeURIComponent(data.units[0].unitId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      setPromptView(json);
    } catch {
      showError("Prompt görüntülenemedi.");
    } finally {
      setIsPromptLoading(false);
    }
  }

  const isVariantActive = data?.control.activeVariants.includes(selectedVariant) && !data.control.paused;
  const meta = VARIANT_META[selectedVariant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Soru Havuzu Üretim Paneli" variant="center" widthClassName="max-w-3xl">
      {!data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 rounded-xl bg-cream-card p-1 dark:bg-white/5">
              {(Object.keys(VARIANT_META) as Variant[]).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setSelectedVariant(v);
                    setPromptView(null);
                  }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    selectedVariant === v ? "bg-white text-espresso shadow-sm dark:bg-midnight-card dark:text-cream" : "text-espresso-muted hover:text-espresso dark:text-cream/40 dark:hover:text-cream",
                  )}
                >
                  {VARIANT_META[v].label} ({VARIANT_META[v].questionCount})
                  {!VARIANT_META[v].implemented && <span className="ml-1 text-[9px] text-amber-500">yakında</span>}
                </button>
              ))}
            </div>
            {!data.control.paused && (
              <button onClick={() => postAction("pause")} disabled={isToggling} className="flex items-center gap-1 text-[11px] text-espresso-muted hover:text-rose-600 dark:text-cream/40">
                <PauseCircle className="h-3.5 w-3.5" /> Tümünü Duraklat
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-espresso-muted dark:text-cream/40">{meta.description}</p>
            {meta.implemented && (
              <button onClick={viewPrompt} disabled={isPromptLoading} className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-400">
                {isPromptLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />} Prompt&apos;u Gör
              </button>
            )}
          </div>

          {promptView && (
            <div className="rounded-xl border border-hairline bg-cream-card p-3 dark:border-white/10 dark:bg-white/5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold text-espresso dark:text-cream">Gerçek Prompt (1. tur örneği — worker&apos;ın çalıştırdığı kodun ta kendisi)</p>
                <button onClick={() => setPromptView(null)} className="text-espresso-muted hover:text-espresso dark:text-cream/40">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">System Prompt</p>
              <pre className="mb-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white/70 p-2 font-mono text-[10px] leading-relaxed text-espresso dark:bg-midnight-card/60 dark:text-cream">{promptView.systemPrompt}</pre>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">User Prompt (örnek birim)</p>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white/70 p-2 font-mono text-[10px] leading-relaxed text-espresso dark:bg-midnight-card/60 dark:text-cream">{promptView.userPrompt}</pre>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-cream-card p-3 text-center dark:bg-white/5">
              <p className="text-lg font-bold text-espresso dark:text-cream">{data.summaries[selectedVariant].totals.questionCount.toLocaleString("tr-TR")}</p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Toplam Soru</p>
            </div>
            <div className="rounded-xl bg-cream-card p-3 text-center dark:bg-white/5">
              <p className="text-lg font-bold text-espresso dark:text-cream">
                {data.summaries[selectedVariant].totals.roundsSuccess}/{data.summaries[selectedVariant].totalTargetRounds}
              </p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Başarılı Tur</p>
            </div>
            <div className="rounded-xl bg-cream-card p-3 text-center dark:bg-white/5">
              <p className={cn("text-lg font-bold", data.summaries[selectedVariant].totals.roundsFailed > 0 ? "text-rose-600 dark:text-rose-400" : "text-espresso dark:text-cream")}>
                {data.summaries[selectedVariant].totals.roundsFailed}
              </p>
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
            onClick={() => postAction(isVariantActive ? "pause" : "resume", selectedVariant)}
            disabled={isToggling || !meta.implemented}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50",
              isVariantActive ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300" : "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
            )}
          >
            {isToggling ? <Loader2 className="h-4 w-4 animate-spin" /> : isVariantActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {!meta.implemented ? "Bu Tür Henüz Hazır Değil" : isVariantActive ? `${meta.label} Çalışıyor — Durdur` : `${meta.label} Türünü Başlat`}
          </button>

          <div className="max-h-[45vh] space-y-1.5 overflow-y-auto pr-1">
            {data.units.map((u) => {
              const pct = Math.round((u.roundsSuccess / data.summaries[selectedVariant].targetRounds) * 100);
              return (
                <div key={u.unitId} className="rounded-lg border border-hairline bg-white/50 px-3 py-2 dark:border-white/10 dark:bg-midnight-card/40">
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-espresso dark:text-cream">{u.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-espresso-muted dark:text-cream/40">
                      {u.roundsFailed > 0 && <AlertTriangle className="h-3 w-3 text-rose-500" />}
                      <Database className="h-3 w-3" /> {u.questionCount}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
                    <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
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
