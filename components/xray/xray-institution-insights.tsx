"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingDown, ChevronDown, Users } from "lucide-react";
import { XRAY_SUBJECTS } from "@/lib/mock-data";
import { useToast } from "@/lib/toast-context";
import { MathText } from "@/components/ui/math-text";
import { cn } from "@/lib/utils";

type KazanimRow = { kazanimId: string; subtopicId: string; subtopicName: string; checks: string; wrongCount: number; studentCount: number };

// Faz O — kurum genelinde en çok zorlanılan kazanımlar. Test 2/toplu
// atama panellerinin AKSİNE bu SEÇİLİ öğrenciden bağımsız, tüm kurumu
// kapsayan bir sinyal — bu yüzden XrayMonthlyScreeningPanel'in yanında,
// /xray/principal sayfasında AYRI bir bölüm olarak gösterilir.
export function XrayInstitutionInsights() {
  const { showError } = useToast();
  const [subject, setSubject] = useState(XRAY_SUBJECTS[0]);
  const [rows, setRows] = useState<KazanimRow[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    setRows(null);
    fetch(`/api/xray/institution-insights?subject=${encodeURIComponent(subject)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setRows(data.topKazanims ?? []))
      .catch(() => showError("Kurum içgörüleri yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, expanded]);

  const maxCount = rows && rows.length > 0 ? Math.max(...rows.map((r) => r.wrongCount)) : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-[1600px] overflow-hidden rounded-3xl border border-rose-500/20 bg-white/70 shadow-sm backdrop-blur-sm dark:border-rose-400/15 dark:bg-midnight-card/50"
    >
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-espresso dark:text-cream">
          <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          En Çok Zorlanılan Kazanımlar
        </span>
        <ChevronDown className={cn("h-4 w-4 text-espresso-muted transition-transform dark:text-cream/40", expanded && "rotate-180")} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5">
              <select
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="mb-3 rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-rose-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
              >
                {XRAY_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {rows === null && <p className="text-xs text-espresso-muted dark:text-cream/40">Yükleniyor...</p>}
              {rows !== null && rows.length === 0 && (
                <p className="text-xs text-espresso-muted dark:text-cream/40">Bu ders için henüz yeterli test verisi yok.</p>
              )}
              {rows !== null && rows.length > 0 && (
                <div className="space-y-2.5">
                  {rows.map((r, i) => (
                    <div key={r.kazanimId} className="rounded-xl bg-cream-card p-3 dark:bg-white/5">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                            {i + 1}
                          </span>
                          <span className="truncate">{r.subtopicName}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-espresso-muted dark:text-cream/40">
                          <Users className="h-3 w-3" /> {r.studentCount} öğrenci
                        </span>
                      </div>
                      <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                        <div className="h-full rounded-full bg-rose-500" style={{ width: `${(r.wrongCount / maxCount) * 100}%` }} />
                      </div>
                      <MathText text={r.checks} className="text-[11px] leading-relaxed text-espresso-muted dark:text-cream/50" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
