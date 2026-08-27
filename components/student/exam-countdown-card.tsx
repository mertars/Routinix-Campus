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

function useDaysRemaining(targetIso: string) {
  const countdown = useCountdownTo(targetIso);
  return countdown ? countdown.days : null;
}

// Yönetici panelindeki (bkz. components/principal/hero.tsx) minimalist geri
// sayım kapsülüyle AYNI kalıp — StudentHero'nun sağ üst köşesinde duran
// küçük bir cam kapsül (bkz. app/student/page.tsx üzerinden StudentHero).
// "Genel" izleme türünde (henüz LGS/YKS yılı belirlenmemiş öğrenci)
// gösterilecek anlamlı bir sınav tarihi olmadığı için hiç render edilmez.
export function ExamCountdownChip() {
  const { track } = useStudentScope();
  const isLgs = track === "lgs";
  const targetIso = isLgs ? LGS_DATE : TYT_DATE;
  const daysRemaining = useDaysRemaining(targetIso);

  if (track === "genel") return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      whileHover={{ y: -2 }}
      className="flex items-center gap-2 rounded-2xl border border-hairline bg-white/70 px-5 py-3 backdrop-blur-sm transition-colors dark:border-brand-500/20 dark:bg-midnight-card/50 dark:backdrop-blur-sm dark:hover:border-brand-500/40"
    >
      <motion.span
        animate={{ rotate: [0, 180, 180, 0, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", times: [0, 0.15, 0.5, 0.65, 1] }}
        className="inline-flex"
      >
        <Hourglass className="h-4 w-4 text-brand-600" />
      </motion.span>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-espresso/50 dark:text-cream/40">
          {isLgs ? "LGS Geri Sayımı" : "YKS Geri Sayımı"}
        </p>
        <p className="text-lg font-bold leading-tight text-espresso dark:text-cream">
          {daysRemaining != null ? `${daysRemaining} gün` : "—"}
        </p>
      </div>
    </motion.div>
  );
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

// Tam boy geri sayım kartı — SADECE "Sınav Geri Sayımı & Motivasyon"
// sekmesinde kullanılır (bkz. tabs/exam-countdown.tsx). Ana sayfa
// (Overview) artık bunun yerine kompakt ExamCountdownChip + TodayScheduleCard
// kullanıyor — bu bileşen kaldırılmadı, sadece o TEK kullanım yerinden
// taşındı.
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
        <p className="mt-3 text-xs text-cream/60">Düzenli çalışma ve soru pratiği en güçlü hazırlık yöntemidir.</p>
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
