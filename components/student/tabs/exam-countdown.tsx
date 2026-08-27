"use client";

import { motion } from "framer-motion";
import { ListChecks } from "lucide-react";
import { ExamCountdownCard } from "@/components/student/exam-countdown-card";
import { useStudentScope } from "@/lib/student-scope";

const TIPS: Record<string, string[]> = {
  lgs: [
    "Her gün en az bir Türkçe ve bir Matematik denemesi çöz.",
    "Yanlışlarını aynı gün içinde tekrar et, biriktirme.",
    "Sınav öncesi son hafta yeni konuya girme, tekrara odaklan.",
  ],
  yks: [
    "TYT ve AYT netlerini haftalık takip et, dalgalanmaları not al.",
    "Zayıf olduğun 2-3 konuya bu hafta öncelik ver.",
    "Deneme sonrası analiz süresini asla atlama.",
  ],
  genel: [
    "Küçük, düzenli hedefler büyük başarıların temelidir.",
    "Her gün en az 1 saatlik odaklanmış çalışma bloğu ayır.",
    "Öğretmenlerinle düzenli iletişimde kal.",
  ],
};

export function ExamCountdownTab() {
  const { track } = useStudentScope();
  const tips = TIPS[track] ?? TIPS.genel;

  return (
    <div className="space-y-4">
      <ExamCountdownCard />

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <ListChecks className="h-4 w-4 text-brand-600" /> Bu Hafta İçin Öneriler
        </h2>
        <ul className="space-y-2">
          {tips.map((tip, i) => (
            <li key={i} className="flex gap-2 text-xs text-espresso-muted dark:text-cream/50">
              <span className="shrink-0 font-semibold text-brand-600">{i + 1}.</span> {tip}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
