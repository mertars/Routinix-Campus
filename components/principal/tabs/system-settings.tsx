"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const TOGGLES = [
  {
    id: "autoNudge",
    label: "Otomatik Nudge",
    description: "Gecikmiş görevlerde öğrenciye otomatik hatırlatma gönder",
    defaultValue: true,
  },
  {
    id: "weeklyBriefing",
    label: "Haftalık Brifing E-postası",
    description: "Pazartesi sabahı özet e-postası gönder",
    defaultValue: true,
  },
  {
    id: "riskAlerts",
    label: "Risk Skoru Bildirimleri",
    description: "Riskli öğrenci tespit edildiğinde anlık bildirim",
    defaultValue: false,
  },
] as const;

export function SystemSettingsTab() {
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(TOGGLES.map((toggle) => [toggle.id, toggle.defaultValue]))
  );

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -3 }}
      className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70"
    >
      <h2 className="mb-4 text-sm font-semibold text-espresso dark:text-cream">Nudge Parametreleri</h2>
      <div className="divide-y divide-hairline dark:divide-white/10">
        {TOGGLES.map((toggle) => (
          <div key={toggle.id} className="flex items-center justify-between py-3">
            <div className="pr-4">
              <p className="text-sm font-medium text-espresso dark:text-cream">{toggle.label}</p>
              <p className="text-xs text-espresso-muted dark:text-cream/40">{toggle.description}</p>
            </div>
            <button
              onClick={() => setToggles((prev) => ({ ...prev, [toggle.id]: !prev[toggle.id] }))}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                toggles[toggle.id] ? "bg-espresso dark:bg-brand-600" : "bg-hairline dark:bg-white/10"
              }`}
            >
              <motion.span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                animate={{ left: toggles[toggle.id] ? "22px" : "2px" }}
                transition={{ duration: 0.2 }}
              />
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
