"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Hourglass, Sparkles } from "lucide-react";
import { useStudentScope } from "@/lib/student-scope";

// ⚠️ Aşağıdaki tarihler TEMSİLİDİR — gerçek ÖSYM/MEB sınav takvimini
// doğrulamadan yazılmadı. Sadece geri sayım mimarisini göstermek amaçlıdır,
// yayına almadan önce güncel resmi tarihlerle değiştirilmelidir.
const LGS_DATE = "2027-06-06T10:15:00";
const TYT_DATE = "2027-06-19T10:15:00";
const AYT_DATE = "2027-06-20T10:15:00";

const MOTIVATION_QUOTES = [
  "Küçük adımlar, büyük hedeflere götürür.",
  "Bugün çözdüğün her soru, yarının netidir.",
  "Disiplin, motivasyonun bittiği yerde başlar.",
  "Hedefin net, çalışman düzenli olsun.",
];

// 'now' başlangıçta bilerek null: sunucu prerender anındaki saat ile
// istemcinin hydrate olduğu andaki gerçek saat kaçınılmaz olarak farklı
// olacağından, ilk render'da SUNUCU VE İSTEMCİ AYNI (null/placeholder)
// içeriği üretmeli — gerçek sayaç yalnızca mount sonrası effect'te başlar.
function useCountdownTo(targetIso: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  if (now === null) return null;
  const diff = Math.max(0, new Date(targetIso).getTime() - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { days, hours, minutes, seconds };
}

function CountdownBlock({ label, targetIso }: { label: string; targetIso: string }) {
  const countdown = useCountdownTo(targetIso);
  return (
    <div className="flex-1 rounded-2xl bg-white/10 p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-white">{countdown ? countdown.days : "--"}</p>
      <p className="text-[9px] text-white/60">
        {countdown
          ? `gün ${String(countdown.hours).padStart(2, "0")}:${String(countdown.minutes).padStart(2, "0")}:${String(countdown.seconds).padStart(2, "0")}`
          : "gün --:--:--"}
      </p>
    </div>
  );
}

export function ExamCountdownCard() {
  const { track } = useStudentScope();
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    if (track !== "genel") return;
    const interval = setInterval(() => setQuoteIndex((i) => (i + 1) % MOTIVATION_QUOTES.length), 5000);
    return () => clearInterval(interval);
  }, [track]);

  if (track === "genel") {
    return (
      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl bg-espresso p-6 text-cream shadow-lg dark:bg-brand-600/90">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-cream/60">
          <Sparkles className="h-3.5 w-3.5" /> Akademik Başarı & Motivasyon
        </div>
        <motion.p key={quoteIndex} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-lg font-semibold leading-snug">
          {MOTIVATION_QUOTES[quoteIndex]}
        </motion.p>
        <p className="mt-3 text-xs text-cream/60">Düzenli çalışma ve soru pratiği en güçlü hazırlık yöntemindir.</p>
      </motion.div>
    );
  }

  return (
    <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl bg-espresso p-6 text-cream shadow-lg dark:bg-brand-600/90">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-cream/60">
        <Hourglass className="h-3.5 w-3.5" /> {track === "lgs" ? "LGS Geri Sayımı" : "YKS Geri Sayımı"}
      </div>
      <div className="flex gap-2.5">
        {track === "lgs" ? (
          <CountdownBlock label="LGS" targetIso={LGS_DATE} />
        ) : (
          <>
            <CountdownBlock label="TYT" targetIso={TYT_DATE} />
            <CountdownBlock label="AYT" targetIso={AYT_DATE} />
          </>
        )}
      </div>
      <p className="mt-3 text-[10px] text-cream/50">Tarih örnek amaçlıdır, güncel ÖSYM/MEB takvimini kontrol edin.</p>
    </motion.div>
  );
}
