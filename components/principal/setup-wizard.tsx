"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Lock, Rocket, ArrowRight, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type StepKey = "branches" | "teachers" | "students" | "schedule" | "account" | "plans" | "smsConsent";

type Step = {
  key: StepKey;
  label: string;
  hint: string;
  done: boolean;
  detail: string;
  blockedBy: StepKey[];
  required: boolean;
  tab?: string;
  href?: string;
};

type Status = {
  steps: Step[];
  completedRequired: number;
  totalRequired: number;
  isComplete: boolean;
  nextKey: StepKey | null;
};

const SHORT_LABEL: Record<StepKey, string> = {
  branches: "şubeler",
  teachers: "öğretmenler",
  students: "öğrenciler",
  schedule: "ders programı",
  account: "kasa hesabı",
  plans: "taksit planları",
  smsConsent: "SMS izinleri",
};

// Kurulum sihirbazı.
//
// Sıfırdan açılan bir kurumda panelde 18 sekme var ve hepsi boş; müdür
// neyi hangi sırada yapacağını bilmiyordu. Bu kutu sırayı söyler,
// sırası gelmemiş adımı KİLİTLİ gösterir ve sebebini yazar.
//
// Zorunlu adımlar bitince tamamen KAYBOLUR — kurulmuş bir kurumda
// kalıcı "yapılacaklar" kutusu gürültüdür.
export function SetupWizard({ onGoTab }: { onGoTab: (tab: string) => void }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/setup-status");
      setStatus(res.ok ? await res.json() : null);
    } catch {
      // Sihirbaz yardımcı bir katman; yüklenemezse panel çalışmaya devam eder.
      setStatus(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Müdür sekmeye gidip iş yaptıktan sonra geri döndüğünde kutu güncel
  // olsun: sekme değişimini izlemek yerine pencere yeniden odaklanınca
  // tazeleniyor (ucuz ve her yolu kapsıyor).
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  if (!status || status.isComplete) return null;

  const percent = Math.round((status.completedRequired / status.totalRequired) * 100);
  const nextStep = status.steps.find((s) => s.key === status.nextKey) ?? null;

  function go(step: Step) {
    if (step.blockedBy.length > 0) return;
    if (step.href) router.push(step.href);
    else if (step.tab) onGoTab(step.tab);
  }

  return (
    <div className="mb-4 rounded-2xl border border-brand-500/30 bg-brand-500/[0.04] p-4 dark:border-brand-500/25">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Rocket className="h-4 w-4 text-brand-600" /> Kurulum Sihirbazı
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
            {status.completedRequired}/{status.totalRequired} zorunlu adım
          </span>
          <button
            onClick={() => void load(true)}
            aria-label="Durumu yenile"
            className="text-espresso-muted transition hover:text-brand-600 dark:text-cream/40"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Listeyi kapat" : "Listeyi aç"}
            className="text-espresso-muted transition hover:text-brand-600 dark:text-cream/40"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="my-3 h-1.5 overflow-hidden rounded-full bg-espresso/10 dark:bg-white/10">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${percent}%` }} />
      </div>

      {/* Sıradaki adım tek başına öne çıkarılır: "18 sekmeden hangisi"
          sorusunun cevabı tek bir düğme olsun. */}
      {nextStep && (
        <button
          onClick={() => go(nextStep)}
          className="mb-3 flex w-full items-center gap-3 rounded-xl bg-espresso px-4 py-3 text-left text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide opacity-70">Sıradaki adım</p>
            <p className="truncate text-sm font-semibold">{nextStep.label}</p>
            <p className="truncate text-[11px] opacity-80">{nextStep.hint}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </button>
      )}

      {expanded && (
        <div className="space-y-1.5">
          {status.steps.map((step) => {
            const blocked = step.blockedBy.length > 0 && !step.done;
            const Icon = step.done ? CheckCircle2 : blocked ? Lock : Circle;
            return (
              <button
                key={step.key}
                onClick={() => go(step)}
                disabled={blocked || step.done}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition",
                  step.done && "opacity-60",
                  blocked && "cursor-not-allowed opacity-60",
                  !step.done && !blocked && "hover:bg-white/70 dark:hover:bg-white/5"
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    step.done ? "text-green-600" : blocked ? "text-espresso-muted dark:text-cream/40" : "text-brand-600"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-espresso dark:text-cream">
                    {step.label}
                    <span className="text-[11px] font-normal text-espresso-muted dark:text-cream/40">· {step.detail}</span>
                    {!step.required && (
                      <span className="rounded-full bg-espresso/5 px-1.5 text-[10px] text-espresso-muted dark:bg-white/10 dark:text-cream/40">
                        sonra da yapılabilir
                      </span>
                    )}
                  </p>
                  {/* "Yapılmadı" ile "henüz yapılamaz" farklı şeyler —
                      engelin sebebi yazılır ki müdür çıkmaza girmesin. */}
                  {blocked ? (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      Önce {step.blockedBy.map((b) => SHORT_LABEL[b]).join(" ve ")} tamamlanmalı.
                    </p>
                  ) : (
                    !step.done && <p className="text-[11px] text-espresso-muted dark:text-cream/40">{step.hint}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
