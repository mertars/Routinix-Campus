"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock3, Save, Loader2 } from "lucide-react";
import { useToast } from "@/lib/toast-context";

function EtutSettingsCard() {
  const { showError, showSuccess } = useToast();
  const [duration, setDuration] = useState("20");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/admin/etut-settings")
      .then((res) => res.json())
      .then((data) => setDuration(String(data.durationMinutes ?? 20)))
      .catch(() => showError("Etüt ayarı yüklenemedi."))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/etut-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes: Number(duration) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      showSuccess("Etüt süresi güncellendi.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -3 }}
      className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <Clock3 className="h-4 w-4 text-brand-600" /> Etüt Randevu Ayarları
      </h2>
      <p className="mb-4 text-xs text-espresso-muted dark:text-cream/40">
        Kurum genelinde tek bir etüt süresi kullanılır — öğretmenlerin müsaitlik aralıkları bu süreye göre slotlara bölünür.
      </p>
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
            Etüt Süresi (dakika)
          </span>
          <input
            type="number"
            min={5}
            max={180}
            step={5}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            disabled={!loaded}
            className="w-full rounded-xl border border-hairline bg-white px-3.5 py-2.5 text-sm text-espresso outline-none focus:border-brand-600 disabled:opacity-60 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />
        </label>
        <button
          onClick={save}
          disabled={saving || !loaded}
          className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-espresso px-4 text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Kaydet
        </button>
      </div>
    </motion.div>
  );
}

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
    <div className="space-y-4">
      <EtutSettingsCard />

      <motion.div
        whileHover={{ scale: 1.01, y: -3 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
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
    </div>
  );
}
