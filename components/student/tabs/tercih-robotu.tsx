"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Compass, Info } from "lucide-react";
import { UNIVERSITY_PROGRAMS, HIGH_SCHOOL_PROGRAMS, PREFERENCE_CATEGORY_LABEL, type PreferenceCategory } from "@/lib/mock-data";
import { useStudentScope } from "@/lib/student-scope";
import { cn } from "@/lib/utils";

const CATEGORY_STYLES: Record<PreferenceCategory, string> = {
  hayal: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
  ideal: "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300",
  garanti: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
};

export function TercihRobotuTab() {
  const { track, report } = useStudentScope();

  // ⚠️ Aşağıdaki sıralama/puan tahminleri temsilidir, gerçek ÖSYM/MEB
  // istatistiklerine dayanmaz — sadece tercih robotu mimarisini göstermek
  // amacıyla nettten türetilen basit bir formüldür.
  const estimatedRanking = Math.round(300_000 / Math.max(1, report.actualNet));
  const estimatedLgsScore = Math.round(300 + (report.actualNet / 120) * 200);

  const universityMatches = useMemo(() => {
    return UNIVERSITY_PROGRAMS.map((p) => {
      let category: PreferenceCategory | null = null;
      if (estimatedRanking <= p.minRanking * 0.7) category = "garanti";
      else if (estimatedRanking <= p.minRanking * 1.15) category = "ideal";
      else if (estimatedRanking <= p.minRanking * 1.6) category = "hayal";
      return { ...p, category };
    }).filter((p) => p.category !== null);
  }, [estimatedRanking]);

  const highSchoolMatches = useMemo(() => {
    return HIGH_SCHOOL_PROGRAMS.map((p) => {
      let category: PreferenceCategory | null = null;
      if (estimatedLgsScore >= p.minScore * 1.02) category = "garanti";
      else if (estimatedLgsScore >= p.minScore * 0.96) category = "ideal";
      else if (estimatedLgsScore >= p.minScore * 0.9) category = "hayal";
      return { ...p, category };
    }).filter((p) => p.category !== null);
  }, [estimatedLgsScore]);

  if (track === "genel") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 rounded-3xl border border-hairline bg-white/70 p-8 text-center backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <Compass className="h-8 w-8 text-espresso-muted dark:text-cream/30" />
        <p className="text-sm font-medium text-espresso dark:text-cream">Tercih Robotu bu sınıf seviyesinde aktif değil</p>
        <p className="text-xs text-espresso-muted dark:text-cream/40">Bu modül 8. sınıf (LGS) ve 11/12/Mezun (YKS) öğrencileri için etkinleşir.</p>
      </motion.div>
    );
  }

  const matches = track === "lgs" ? highSchoolMatches : universityMatches;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl border border-brand-500/30 bg-brand-50 px-4 py-3 text-xs font-medium text-brand-700 dark:border-brand-500/20 dark:bg-brand-600/10 dark:text-brand-300">
        <Info className="h-4 w-4 shrink-0" />
        {track === "lgs"
          ? `Tahmini LGS puanın: ~${estimatedLgsScore} (temsili, resmi bir puan değildir)`
          : `Tahmini sıralaman: ~${estimatedRanking.toLocaleString("tr-TR")} (temsili, resmi bir sıralama değildir)`}
      </div>

      {(["garanti", "ideal", "hayal"] as PreferenceCategory[]).map((cat) => {
        const items = matches.filter((m) => m.category === cat);
        if (items.length === 0) return null;
        return (
          <motion.div key={cat} whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", CATEGORY_STYLES[cat])}>{PREFERENCE_CATEGORY_LABEL[cat]}</span>
            </h2>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl bg-cream-card p-3 dark:bg-white/5">
                  {"university" in item ? (
                    <>
                      <p className="text-sm font-medium text-espresso dark:text-cream">{item.university}</p>
                      <p className="text-xs text-espresso-muted dark:text-cream/50">{item.department} · {item.city}</p>
                      <p className="mt-0.5 text-[10px] text-espresso-muted/70 dark:text-cream/30">Taban sıralama ~{item.minRanking.toLocaleString("tr-TR")}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-espresso dark:text-cream">{item.schoolName}</p>
                      <p className="text-xs text-espresso-muted dark:text-cream/50">{item.type} · {item.city}</p>
                      <p className="mt-0.5 text-[10px] text-espresso-muted/70 dark:text-cream/30">Taban puan ~{item.minScore}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
