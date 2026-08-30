"use client";

import { motion } from "framer-motion";
import { Scan, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PhaseStatus = "done" | "active" | "upcoming";
type Phase = { label: string; description: string; status: PhaseStatus };

const PHASES: Phase[] = [
  { label: "Temel + Veri Modeli", description: "Konu bazlı teşhis verisinin altyapısı", status: "done" },
  { label: "Röntgen Çek", description: "Öğretmenin öğrenciyi konu konu değerlendirdiği ekran", status: "active" },
  { label: "Sonuç Görselleştirme", description: "Gerçek veriyle zenginleştirilmiş analiz ekranı", status: "upcoming" },
  { label: "Otomatik Reçete", description: "Kural bazlı öneri + Röntgen Raporu PDF'i", status: "upcoming" },
  { label: "Cila", description: "Boş durumlar, mobil uyum, son rötuşlar", status: "upcoming" },
];

function PhaseRow({ phase, index }: { phase: Phase; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="flex items-center gap-3 rounded-2xl bg-cream-card px-4 py-3 dark:bg-white/5"
    >
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          phase.status === "done" && "bg-emerald-500 text-white",
          phase.status === "active" && "bg-sky-500 text-white",
          phase.status === "upcoming" && "bg-cream-muted text-espresso-muted dark:bg-white/10 dark:text-cream/30"
        )}
      >
        {phase.status === "done" && <Check className="h-3.5 w-3.5" />}
        {phase.status === "active" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {phase.status === "upcoming" && <span className="text-[10px] font-bold">{index + 1}</span>}
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-semibold",
            phase.status === "upcoming" ? "text-espresso-muted dark:text-cream/40" : "text-espresso dark:text-cream"
          )}
        >
          {phase.label}
        </p>
        <p className="truncate text-xs text-espresso-muted dark:text-cream/40">{phase.description}</p>
      </div>
      {phase.status === "active" && (
        <span className="ml-auto shrink-0 rounded-full bg-sky-500/10 px-2.5 py-1 text-[10px] font-bold text-sky-600 dark:text-sky-300">
          Şu an
        </span>
      )}
    </motion.div>
  );
}

// Faz 1'in görünür teslimatı — modülün iskeleti (route/auth/layout) çalışıyor
// ama gerçek röntgen ekranları (Faz 2-4) henüz yok. Boş bir "yakında" yazısı
// yerine şeffaf bir yol haritası: kullanıcı nerede olduğumuzu görsün.
export function XrayRoadmapHero({ intro }: { intro: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-3xl border border-hairline bg-white/70 p-6 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300">
          <Scan className="h-7 w-7" />
        </div>
        <h1 className="text-lg font-bold text-espresso dark:text-cream">Akademik Röntgen</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-espresso-muted dark:text-cream/40">{intro}</p>
      </motion.div>

      <div className="space-y-2">
        {PHASES.map((phase, index) => (
          <PhaseRow key={phase.label} phase={phase} index={index} />
        ))}
      </div>
    </div>
  );
}
