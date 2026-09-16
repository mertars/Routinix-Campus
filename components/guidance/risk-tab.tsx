"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CalendarPlus, FolderOpen, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { RISK_REASON_LABEL, type RiskReason } from "@/lib/mock-data";
import { useCachedFetch } from "@/lib/client/cached-fetch";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

// RİSK RADARI — rehberlik sürümü.
//
// ⚠️ Yönetici tarafındaki radardan farkı: burada amaç izlemek değil,
// GÖRÜŞMEYE DÖNÜŞTÜRMEK. Her satırdan tek tuşla görüşme planlanır,
// çünkü rehberliğin bu ekrandan çıktısı her zaman bir görüşmedir.
//
// ⚠️ 2026-09-16 (Mert): tek tuş vardı, adı "Görüşme aç"tı ama öğrenci
// DOSYASINA atıyordu — isim ile davranış tutmuyordu. Artık iki ayrı tuş:
// "Görüşme Planla" takvime, "Dosya" öğrenci dosyasına gider ve İKİSİ DE
// seçili öğrenciyi yanında taşır.
//
// ⚠️ Filtreler (Mert: "net düşüşü devamsızlık gibi filtreler olsun"):
// radar kurum genelini döndüğü için 100+ satır olabiliyor; rehber
// "bugün devamsızlıkla ilgileneceğim" diyebilmeli.

type RiskEntry = { id: string; name: string; branch: string; riskScore: number; reason: RiskReason };

const REASON_FILTERS: { value: RiskReason | "all"; label: string }[] = [
  { value: "all", label: "Tüm sebepler" },
  { value: "net_drop", label: RISK_REASON_LABEL.net_drop },
  { value: "attendance_gap", label: RISK_REASON_LABEL.attendance_gap },
  { value: "homework_gap", label: RISK_REASON_LABEL.homework_gap },
  { value: "mastery_gap", label: RISK_REASON_LABEL.mastery_gap },
];

// ⚠️ EŞİKLER GERÇEK ÖLÇEĞE GÖRE (2026-09-16'da ölçüldü): compute-risk.ts'in
// puanı dört cezanın ağırlıklı toplamıdır (devam 0.30 + net 0.30 + röntgen
// 0.25 + ödev 0.15) ve pratikte 70'e ULAŞMAZ — Arslan'ın 102 öğrencisinde
// en yüksek skor 54 çıktı. Eski arayüz "70+ ise kırmızı" diyordu, yani
// kurumun EN RİSKLİ öğrencisi bile hiçbir zaman kırmızı görünmüyordu.
// Eşikler gerçek dağılıma göre yeniden ayarlandı.
const CRITICAL_SCORE = 45;
const ATTENTION_SCORE = 30;

const LEVEL_FILTERS: { value: "all" | "high" | "mid"; label: string; test: (score: number) => boolean }[] = [
  // ⚠️ VARSAYILAN "takip gerektiren": radar kurum genelini döndüğü için
  // listede skoru 0 olan onlarca öğrenci de vardı (102 satırın 79'u 25'in
  // altındaydı) — rehber, ilgilenmesi gereken 20 kişiyi bulmak için
  // kaydırmak zorunda kalıyordu.
  { value: "mid", label: `Takip gerektiren (${ATTENTION_SCORE}+)`, test: (s) => s >= ATTENTION_SCORE },
  { value: "high", label: `Kritik (${CRITICAL_SCORE}+)`, test: (s) => s >= CRITICAL_SCORE },
  { value: "all", label: "Tümü", test: () => true },
];

const REASON_TONE: Record<RiskReason, string> = {
  net_drop: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  attendance_gap: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  homework_gap: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  mastery_gap: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
};

export function RiskTab({
  onOpenStudent,
  onPlanMeeting,
}: {
  onOpenStudent: (studentId: string) => void;
  /** ⚠️ "Görüşme Planla" ARTIK görüşme takvimine gider (Mert: "yanlış yere
   *  atıyor, görüşme açma değil öğrenci dosyası ekranına atıyor"). */
  onPlanMeeting: (studentId: string) => void;
}) {
  const { showError } = useToast();
  // ⚠️ Önbellekli: sekmeye geri dönmek anlık. Risk radarı kurum genelini
  // tarayan pahalı bir uçtur (sunucuda ayrıca 20 sn TTL cache var), her
  // sekme değişiminde sıfırdan beklemenin anlamı yoktu.
  const { data, failed } = useCachedFetch<{ entries: RiskEntry[] }>("/api/risk-radar", { ttlMs: 60_000 });
  const entries = data?.entries ?? null;
  const [reason, setReason] = useState<RiskReason | "all">("all");
  const [level, setLevel] = useState<"all" | "high" | "mid">("mid");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (failed) showError("Risk radarı yüklenemedi.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed]);

  // Sebep filtresi rozetlerinde gerçek sayı göstermek için — "Devamsızlık (0)"
  // yazan bir filtreye basıp boş liste görmek zaman kaybı.
  const reasonCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries ?? []) map.set(e.reason, (map.get(e.reason) ?? 0) + 1);
    return map;
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    const levelTest = LEVEL_FILTERS.find((l) => l.value === level)?.test ?? (() => true);
    return (entries ?? []).filter(
      (e) =>
        (reason === "all" || e.reason === reason) &&
        levelTest(e.riskScore) &&
        (q.length === 0 ||
          e.name.toLocaleLowerCase("tr").includes(q) ||
          e.branch.toLocaleLowerCase("tr").includes(q))
    );
  }, [entries, reason, level, query]);

  const criticalCount = (entries ?? []).filter((e) => e.riskScore >= CRITICAL_SCORE).length;

  return (
    <div className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <AlertTriangle className="h-4 w-4 text-brand-600" /> Risk Radarı
          </h2>
          <p className="text-[11.5px] text-espresso-muted dark:text-cream/45">
            Devamsızlık, net düşüşü, ödev ve röntgen sinyallerinden 100 üzerinden hesaplanır. Kurum geneli — şubeye bağlı
          değildir. Varsayılan olarak yalnızca {ATTENTION_SCORE} puan ve üzeri, yani gerçekten takip gerektirenler listelenir.
          </p>
        </div>
        {entries !== null && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-rose-500/12 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
              {criticalCount} kritik
            </span>
            <span className="rounded-full bg-cream-card px-2.5 py-1 text-[11px] font-semibold text-espresso-muted dark:bg-white/5 dark:text-cream/50">
              {visible.length}/{entries.length} öğrenci
            </span>
          </div>
        )}
      </div>

      {/* FİLTRELER */}
      <div className="mb-4 space-y-2.5 rounded-2xl border border-hairline bg-cream-card/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
          <SlidersHorizontal className="h-3 w-3" /> Filtrele
        </div>
        <div className="flex flex-wrap gap-1.5">
          {REASON_FILTERS.map((f) => {
            const count = f.value === "all" ? entries?.length ?? 0 : reasonCounts.get(f.value) ?? 0;
            return (
              <button
                key={f.value}
                onClick={() => setReason(f.value)}
                className={cn(
                  "min-h-[34px] rounded-full border px-3 text-[11.5px] font-medium transition",
                  reason === f.value
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-hairline bg-white/70 text-espresso-muted hover:border-brand-500/40 dark:border-white/10 dark:bg-white/5 dark:text-cream/55"
                )}
              >
                {f.label}
                {entries !== null && <span className="ml-1 opacity-60">{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {LEVEL_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setLevel(f.value)}
              className={cn(
                "min-h-[34px] rounded-full border px-3 text-[11.5px] font-medium transition",
                level === f.value
                  ? "border-espresso bg-espresso text-cream dark:border-brand-500 dark:bg-brand-600 dark:text-white"
                  : "border-hairline bg-white/70 text-espresso-muted hover:border-brand-500/40 dark:border-white/10 dark:bg-white/5 dark:text-cream/55"
              )}
            >
              {f.label}
            </button>
          ))}
          <div className="relative ml-auto min-w-[160px] flex-1 sm:max-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="İsim veya şube ara..."
              className="min-h-[34px] w-full rounded-full border border-hairline bg-white/80 pl-8 pr-3 text-[12px] text-espresso outline-none transition focus:border-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-cream"
            />
          </div>
        </div>
      </div>

      {entries === null && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-4 w-4 animate-spin text-espresso-muted dark:text-cream/40" />
        </div>
      )}

      <div className="space-y-2">
        {visible.map((entry, index) => {
          const isHigh = entry.riskScore >= CRITICAL_SCORE;
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(index, 8) * 0.03 }}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline border-l-4 px-3 py-2.5 transition hover:shadow-sm dark:border-white/10",
                isHigh
                  ? "border-l-rose-500 bg-rose-50/60 dark:bg-rose-500/10"
                  : "border-l-brand-500 bg-cream-card dark:bg-white/5"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-espresso dark:text-cream">{entry.name}</p>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", REASON_TONE[entry.reason])}>
                    {RISK_REASON_LABEL[entry.reason]}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">
                  {entry.branch} · Risk puanı {entry.riskScore}
                </p>
                {/* Skor çubuğu — 100 üzerinden; rakama bakmadan da sırayı gösterir. */}
                <div className="mt-1.5 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-espresso/10 dark:bg-white/10">
                  <div
                    className={cn("h-full rounded-full", isHigh ? "bg-rose-500" : "bg-brand-500")}
                    style={{ width: `${Math.min(100, entry.riskScore)}%` }}
                  />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => onPlanMeeting(entry.id)}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-full bg-espresso px-3 text-[11px] font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
                >
                  <CalendarPlus className="h-3 w-3" /> Görüşme Planla
                </button>
                <button
                  onClick={() => onOpenStudent(entry.id)}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-hairline bg-white/80 px-3 text-[11px] font-semibold text-espresso-muted transition hover:border-brand-500/40 hover:text-brand-600 dark:border-white/10 dark:bg-white/5 dark:text-cream/60"
                >
                  <FolderOpen className="h-3 w-3" /> Dosya
                </button>
              </div>
            </motion.div>
          );
        })}
        {entries !== null && visible.length === 0 && (
          <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">
            {entries.length === 0
              ? "Şu an risk uyarısı olan öğrenci yok."
              : "Bu filtreyle eşleşen öğrenci yok — filtreleri gevşetin."}
          </p>
        )}
      </div>
    </div>
  );
}
