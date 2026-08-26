"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { UserCog, Bell, Palette, Check, RotateCcw, KeyRound, GraduationCap } from "lucide-react";
import { useStudentScope, DEMO_GRADE_CHOICES } from "@/lib/student-scope";
import { useAccent } from "@/lib/accent-context";
import { ACCENT_PRESETS, DEFAULT_ACCENT_HEX } from "@/lib/color-utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import { cn } from "@/lib/utils";

type NotificationPrefs = { homework: boolean; announcements: boolean; appointments: boolean; popQuiz: boolean };

const DEFAULT_PREFS: NotificationPrefs = { homework: true, announcements: true, appointments: true, popQuiz: true };

const PREF_LABELS: Record<keyof NotificationPrefs, string> = {
  homework: "Ödev Bildirimleri",
  announcements: "Duyuru & Etkinlik Bildirimleri",
  appointments: "Etüt/Randevu Durum Bildirimleri",
  popQuiz: "Pop-Quiz Anlık Bildirimleri",
};

export function ProfileTab() {
  const { studentName, branchName, demoGradeKey, setDemoGradeKey } = useStudentScope();
  const { hex, setAccent, resetAccent } = useAccent();
  const isDefaultAccent = hex.toLowerCase() === DEFAULT_ACCENT_HEX.toLowerCase();
  const [prefs, setPrefs] = useLocalStorageState<NotificationPrefs>("routinix-kampus-student-notification-prefs", DEFAULT_PREFS);
  const [resetRequested, setResetRequested] = useState(false);

  function togglePref(key: keyof NotificationPrefs) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-4">
      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <UserCog className="h-4 w-4 text-brand-600" /> Profil Bilgileri
        </h2>
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-espresso text-lg font-bold text-cream dark:bg-brand-600">
            {studentName.slice(0, 1)}
          </span>
          <div>
            <p className="text-sm font-semibold text-espresso dark:text-cream">{studentName}</p>
            <p className="text-xs text-espresso-muted dark:text-cream/40">{branchName}</p>
          </div>
        </div>
        <button
          onClick={() => setResetRequested(true)}
          disabled={resetRequested}
          className={cn(
            "mt-4 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-hairline text-xs font-medium transition dark:border-white/10",
            resetRequested ? "text-green-700 dark:text-green-400" : "text-espresso hover:bg-cream-card dark:text-cream dark:hover:bg-white/5"
          )}
        >
          {resetRequested ? <Check className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
          {resetRequested ? "Şifre sıfırlama talebin alındı" : "Şifremi Sıfırla"}
        </button>
      </motion.div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Bell className="h-4 w-4 text-brand-600" /> Bildirim Tercihleri
        </h2>
        <div className="space-y-2">
          {(Object.keys(DEFAULT_PREFS) as (keyof NotificationPrefs)[]).map((key) => (
            <button
              key={key}
              onClick={() => togglePref(key)}
              className="flex min-h-[44px] w-full items-center justify-between rounded-xl bg-cream-card px-3.5 dark:bg-white/5"
            >
              <span className="text-xs font-medium text-espresso dark:text-cream">{PREF_LABELS[key]}</span>
              <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition", prefs[key] ? "bg-brand-600" : "bg-hairline dark:bg-white/15")}>
                <motion.span
                  animate={{ x: prefs[key] ? 20 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  className="absolute top-1 h-4 w-4 rounded-full bg-white shadow"
                />
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Palette className="h-4 w-4 text-brand-600" /> Görünüm
        </h2>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Vurgu Rengi</p>
        <div className="mb-3 grid grid-cols-5 gap-2">
          {ACCENT_PRESETS.map((preset) => {
            const isActive = preset.hex.toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={preset.hex}
                onClick={() => setAccent(preset.hex)}
                title={preset.label}
                aria-label={preset.label}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition"
                style={{ backgroundColor: preset.hex, borderColor: isActive ? preset.hex : "transparent" }}
              >
                {isActive && (
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-black/20">
                    <Check className="h-4 w-4 text-white" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={resetAccent}
          disabled={isDefaultAccent}
          className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-hairline px-3 py-2.5 text-xs font-medium text-espresso-muted transition hover:bg-cream-card disabled:opacity-40 dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Varsayılana Dön
        </button>
        <div className="flex items-center justify-between rounded-xl bg-cream-card px-3.5 py-2.5 dark:bg-white/5">
          <span className="text-xs text-espresso dark:text-cream">Gece / Gündüz Modu</span>
          <ThemeToggle />
        </div>
      </motion.div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-dashed border-brand-500/40 bg-brand-50/50 p-5 dark:border-brand-500/20 dark:bg-brand-600/5">
        <h2 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <GraduationCap className="h-4 w-4 text-brand-600" /> Demo: Sınıf Seviyesi Önizleme
        </h2>
        <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">
          Bu seçici yalnızca LGS/YKS/Genel akışlarını önizlemek için bir demo aracıdır — net/devam verilerini değiştirmez.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_GRADE_CHOICES.map((choice) => (
            <button
              key={choice.key}
              onClick={() => setDemoGradeKey(choice.key)}
              className={cn(
                "min-h-[44px] rounded-xl px-3 text-xs font-medium transition",
                demoGradeKey === choice.key ? "bg-espresso text-cream dark:bg-brand-600" : "bg-white text-espresso dark:bg-midnight-card dark:text-cream"
              )}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
