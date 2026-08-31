"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, ChevronDown, Loader2, Save } from "lucide-react";
import { XRAY_SUBJECTS } from "@/lib/mock-data";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Config = { grade: number; enabled: boolean; subject: string | null; subtopicId: string | null; subtopicName: string | null; intervalDays: number; nextRunAt: string | null };
type Topic = { subtopicId: string; subtopicName: string; questionCount: number };

function daysUntil(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "bugün";
  return `${days} gün sonra (${new Date(iso).toLocaleDateString("tr-TR")})`;
}

function GradeRow({ config, onSaved }: { config: Config; onSaved: (next: Config) => void }) {
  const { showError, showToast } = useToast();
  const [enabled, setEnabled] = useState(config.enabled);
  const [subject, setSubject] = useState(config.subject ?? XRAY_SUBJECTS[0]);
  const [subtopicId, setSubtopicId] = useState(config.subtopicId ?? "");
  const [intervalDays, setIntervalDays] = useState(config.intervalDays);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/xray/practice-tests?subject=${encodeURIComponent(subject)}`)
      .then((res) => res.json())
      .then((data) => {
        setTopics(data.topics ?? []);
        setSubtopicId((current) => current || data.topics?.[0]?.subtopicId || "");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/xray/monthly-screening-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade: config.grade, enabled, subject, subtopicId, intervalDays }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      const topicName = topics.find((t) => t.subtopicId === subtopicId)?.subtopicName ?? subtopicId;
      showToast("success", `${config.grade}. sınıf tarama ayarı kaydedildi.`);
      onSaved({ grade: config.grade, enabled, subject, subtopicId, subtopicName: topicName, intervalDays, nextRunAt: data.nextRunAt });
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-cream-card p-3.5 dark:bg-white/5">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-espresso dark:text-cream">{config.grade}. Sınıf</span>
        <button
          onClick={() => setEnabled((v) => !v)}
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition", enabled ? "bg-sky-600" : "bg-cream-muted dark:bg-white/15")}
        >
          <motion.span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
            animate={{ left: enabled ? "1.375rem" : "0.125rem" }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {enabled && (
        <div className="mb-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            >
              {XRAY_SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={subtopicId}
              onChange={(event) => setSubtopicId(event.target.value)}
              disabled={topics.length === 0}
              className="min-w-[140px] flex-1 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            >
              {topics.length === 0 && <option value="">Havuzda içerik yok</option>}
              {topics.map((t) => (
                <option key={t.subtopicId} value={t.subtopicId}>
                  {t.subtopicName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-espresso-muted dark:text-cream/50">Her</label>
            <input
              type="number"
              min={1}
              max={365}
              value={intervalDays}
              onChange={(event) => setIntervalDays(Number(event.target.value))}
              className="w-16 rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
            <label className="text-[11px] text-espresso-muted dark:text-cream/50">günde bir</label>
          </div>
        </div>
      )}

      {/* Save butonu BİLEREK enabled=false iken de görünür kalıyor — bir
          önceki sürümde {enabled && (...)} bloğunun İÇİNDEYDİ, bu yüzden
          taramayı kapatmak (enabled=false yapmak) Kaydet butonunu da
          anında gizliyordu ve kapatma kaydedilemiyordu (bkz. kullanıcının
          bildirdiği "kapatsan bile bir daha açınca kapanmadığını
          görüyorum" hatası). */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-espresso-muted/70 dark:text-cream/30">
          {config.enabled && config.subtopicName ? `Şu an: ${config.subtopicName} · Sıradaki tarama: ${daysUntil(config.nextRunAt)}` : enabled ? "Kaydedince aktifleşir." : "Devre dışı — kaydetmek için tıkla."}
        </p>
        <button
          onClick={save}
          disabled={saving || (enabled && topics.length === 0)}
          className="ml-auto flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Kaydet
        </button>
      </div>
    </div>
  );
}

// Faz N — yöneticinin aylık "unutma riski" tarama testi ayarları. Test
// 1/Test 2'nin öğrenci-bazlı atama panellerinden BİLEREK AYRI (o ikisi
// SEÇİLİ öğrenciye özelken, bu kurum geneli/sınıf seviyesi bazlı bir
// AYAR) — bu yüzden XrayResultsPanel'in sağ sütununda değil, /xray/
// principal sayfasında BAĞIMSIZ bir bölüm olarak gösterilir.
export function XrayMonthlyScreeningPanel() {
  const { showError } = useToast();
  const [configs, setConfigs] = useState<Config[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/xray/monthly-screening-config")
      .then((res) => res.json())
      .then((data) => setConfigs(data.configs ?? []))
      .catch(() => showError("Tarama ayarları yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!configs) return null;
  const activeCount = configs.filter((c) => c.enabled).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-[1600px] overflow-hidden rounded-3xl border border-sky-500/20 bg-white/70 shadow-sm backdrop-blur-sm dark:border-sky-400/15 dark:bg-midnight-card/50"
    >
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-espresso dark:text-cream">
          <ShieldAlert className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          Aylık Unutma Riski Taraması
          {activeCount > 0 && (
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">{activeCount} aktif</span>
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-espresso-muted transition-transform dark:text-cream/40", expanded && "rotate-180")} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
              {configs.map((c) => (
                <GradeRow key={c.grade} config={c} onSaved={(next) => setConfigs((prev) => prev!.map((p) => (p.grade === next.grade ? next : p)))} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
