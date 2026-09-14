"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Loader2, NotebookPen } from "lucide-react";
import { RISK_REASON_LABEL, type RiskReason } from "@/lib/mock-data";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

// RİSK RADARI — rehberlik sürümü.
//
// ⚠️ Yönetici tarafındaki radardan farkı: burada amaç izlemek değil,
// GÖRÜŞMEYE DÖNÜŞTÜRMEK. Her satırdan tek tuşla görüşme notu açılır,
// çünkü rehberliğin bu ekrandan çıktısı her zaman bir görüşmedir.
//
// Veri kaynağı zaten rehberliğe açıktı (/api/risk-radar, requireRole'de
// "guidance" var) ama rehberlik panelinde bu ekran HİÇ YOKTU.

type RiskEntry = { id: string; name: string; branch: string; riskScore: number; reason: RiskReason };

export function RiskTab({ onOpenStudent }: { onOpenStudent: (studentId: string) => void }) {
  const { showError } = useToast();
  const [entries, setEntries] = useState<RiskEntry[] | null>(null);

  useEffect(() => {
    fetch("/api/risk-radar")
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => showError("Risk radarı yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
      <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <AlertTriangle className="h-4 w-4 text-brand-600" /> Risk Radarı
      </h2>
      <p className="mb-4 text-[11.5px] text-espresso-muted dark:text-cream/45">
        Devamsızlık, net düşüşü ve ödev takibinden hesaplanır. Kurum geneli — şubeye bağlı değildir.
      </p>

      {entries === null && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-4 w-4 animate-spin text-espresso-muted dark:text-cream/40" />
        </div>
      )}

      <div className="space-y-2">
        {entries?.map((entry, index) => {
          const isHigh = entry.riskScore >= 70;
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(index, 8) * 0.03 }}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-xl border-l-4 px-3 py-2.5",
                isHigh ? "border-rose-500 bg-rose-50/60 dark:bg-rose-500/10" : "border-brand-500 bg-cream-card dark:bg-white/5"
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-espresso dark:text-cream">{entry.name}</p>
                <p className="text-[11px] text-espresso-muted dark:text-cream/40">
                  {entry.branch} · {RISK_REASON_LABEL[entry.reason]} · Risk {entry.riskScore}
                </p>
              </div>
              <button
                onClick={() => onOpenStudent(entry.id)}
                className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full bg-espresso px-3 text-[11px] font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                <NotebookPen className="h-3 w-3" /> Görüşme aç
              </button>
            </motion.div>
          );
        })}
        {entries?.length === 0 && (
          <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">
            Şu an risk uyarısı olan öğrenci yok.
          </p>
        )}
      </div>
    </div>
  );
}
