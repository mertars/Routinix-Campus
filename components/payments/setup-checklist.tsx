"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Rocket, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = { key: string; label: string; hint: string; done: boolean; tab?: string; href?: string };
type Payload = { steps: Step[]; completed: number; total: number; isComplete: boolean };

// İlk kurulum kontrol listesi.
//
// Panele ilk giren müdür dokuz sekme ve dört tane ₺0 görüyordu; nereden
// başlayacağı hiçbir yerde yazmıyordu. Liste tamamlanınca KAYBOLUR —
// kurulmuş bir kurumda kalıcı "yapılacaklar" kutusu gürültüdür.
export function SetupChecklist({ onGoTab }: { onGoTab: (tab: string) => void }) {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    fetch("/api/payments/principal/setup-status")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((d: Payload) => setData(d))
      .catch(() => setData(null));
  }, []);

  if (!data || data.isComplete) return null;

  const percent = Math.round((data.completed / data.total) * 100);

  return (
    <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.04] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Rocket className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Kuruluma Devam Edin
        </h3>
        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {data.completed}/{data.total} tamamlandı
        </span>
      </div>

      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-espresso/10 dark:bg-white/10">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
      </div>

      <div className="space-y-1.5">
        {data.steps.map((s) => {
          const Icon = s.done ? CheckCircle2 : Circle;
          const clickable = !s.done;
          const content = (
            <>
              <Icon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  s.done ? "text-emerald-600 dark:text-emerald-400" : "text-espresso-muted dark:text-cream/30"
                )}
              />
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-xs font-medium",
                    s.done ? "text-espresso-muted line-through dark:text-cream/40" : "text-espresso dark:text-cream"
                  )}
                >
                  {s.label}
                </span>
                {!s.done && <span className="block text-[10px] text-espresso-muted dark:text-cream/40">{s.hint}</span>}
              </span>
              {clickable && s.href && <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-espresso-muted dark:text-cream/40" />}
            </>
          );

          // ERP'de yapılan adım (öğrenci kaydı) dış bağlantıdır; panel
          // içindekiler ilgili sekmeye götürür.
          if (clickable && s.href) {
            return (
              <a
                key={s.key}
                href={s.href}
                className="flex items-start gap-2 rounded-xl border border-hairline bg-white px-3 py-2 transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card/50 dark:hover:bg-white/5"
              >
                {content}
              </a>
            );
          }
          if (clickable && s.tab) {
            return (
              <button
                key={s.key}
                onClick={() => onGoTab(s.tab!)}
                className="flex w-full items-start gap-2 rounded-xl border border-hairline bg-white px-3 py-2 text-left transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card/50 dark:hover:bg-white/5"
              >
                {content}
              </button>
            );
          }
          return (
            <div key={s.key} className="flex items-start gap-2 rounded-xl px-3 py-2">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
