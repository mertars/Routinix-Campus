"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DigestAlert = { key: string; severity: "warning" | "critical"; text: string; tab: string };
type Digest = {
  alerts: DigestAlert[];
  dueTodayCount: number;
  dueTodayTotal: number;
  collectedYesterday: number;
};

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

// Günün uyarı şeridi — panelin EN ÜSTÜNDE.
//
// Kötü haberi bulmak için kartları okumak, sekme gezmek gerekiyordu.
// Uyarı yoksa şerit hiç çizilmez: her gün görünen bir kutu bir süre
// sonra görünmez olur.
export function DigestBanner({ onGoTab }: { onGoTab: (tab: string) => void }) {
  const [data, setData] = useState<Digest | null>(null);

  useEffect(() => {
    fetch("/api/payments/principal/digest")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((d: Digest) => setData(d))
      .catch(() => setData(null));
  }, []);

  if (!data) return null;
  const hasAlerts = data.alerts.length > 0;
  if (!hasAlerts && data.dueTodayCount === 0) return null;

  const critical = data.alerts.some((a) => a.severity === "critical");

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        critical ? "border-rose-400/40 bg-rose-500/[0.06]" : "border-amber-400/35 bg-amber-500/[0.05]"
      )}
    >
      <div className="space-y-1.5">
        {data.alerts.map((a) => (
          <button
            key={a.key}
            onClick={() => onGoTab(a.tab)}
            className={cn(
              "flex w-full items-start gap-2 rounded-lg px-1 py-0.5 text-left text-xs font-medium transition hover:bg-black/[0.03] dark:hover:bg-white/5",
              a.severity === "critical" ? "text-rose-800 dark:text-rose-300" : "text-amber-800 dark:text-amber-300"
            )}
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{a.text}</span>
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
          </button>
        ))}
        {data.dueTodayCount > 0 && (
          <p className="flex items-start gap-2 text-xs font-medium text-espresso dark:text-cream">
            <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-espresso-muted dark:text-cream/40" />
            Bugün vadesi dolan {data.dueTodayCount} taksit · {formatTRY(data.dueTodayTotal)}
          </p>
        )}
      </div>
    </div>
  );
}
