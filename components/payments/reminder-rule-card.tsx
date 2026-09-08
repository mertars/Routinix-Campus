"use client";

import { useEffect, useState } from "react";
import { Loader2, BellRing, Save, Info } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Rule = {
  isActive: boolean;
  daysBefore: number;
  beforeTemplate: string;
  daysAfter: number;
  afterTemplate: string;
  lastRunAt: string | null;
  lastSentCount: number;
};

type Payload = {
  rule: Rule;
  preview: { dueSoonCount: number; overdueCount: number };
  smsCredits: number;
  repeatDays: number;
};

// Otomatik ödeme hatırlatması.
//
// Kontör yakan bir işlem olduğu için "bugün açsaydım kaç kişiye giderdi"
// önizlemesi ekranda duruyor — müdür düğmeye kör basmasın.
export function ReminderRuleCard() {
  const { showError, showSuccess } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [form, setForm] = useState<Rule | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/payments/principal/reminder-rule")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((d: Payload) => {
        setData(d);
        setForm(d.rule);
      })
      .catch(() => showError("Hatırlatma kuralı yüklenemedi."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch("/api/payments/principal/reminder-rule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error);
      showSuccess(form.isActive ? "Otomatik hatırlatma açık." : "Otomatik hatırlatma kapatıldı.");
      load();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream";

  if (!data || !form) {
    return (
      <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      </div>
    );
  }

  const estimated = (form.daysBefore > 0 ? data.preview.dueSoonCount : 0) + (form.daysAfter > 0 ? data.preview.overdueCount : 0);

  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <BellRing className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Otomatik Ödeme Hatırlatması
          </h3>
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">
            Her sabah 09:00&apos;da çalışır. Aynı veliye en sık {data.repeatDays} günde bir SMS gider.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="h-4 w-4 accent-emerald-600"
          />
          <span className={cn("text-xs font-semibold", form.isActive ? "text-emerald-700 dark:text-emerald-300" : "text-espresso-muted dark:text-cream/40")}>
            {form.isActive ? "Açık" : "Kapalı"}
          </span>
        </label>
      </div>

      <div className="mb-3 flex items-start gap-2 rounded-xl border border-hairline bg-cream-card/50 p-3 text-[11px] text-espresso dark:border-white/10 dark:bg-white/[0.03] dark:text-cream">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-espresso-muted dark:text-cream/40" />
        <span>
          Bu ayarlarla bugün <strong>{estimated} veliye</strong> SMS giderdi. Kontör bakiyeniz:{" "}
          <strong>{data.smsCredits}</strong>.
          {data.rule.lastRunAt && (
            <>
              {" "}Son çalışma: {new Date(data.rule.lastRunAt).toLocaleDateString("tr-TR")} ({data.rule.lastSentCount} gönderim).
            </>
          )}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">
            Vadesi yaklaşanlar — kaç gün önce? <span className="text-espresso-muted dark:text-cream/40">(0 = kapalı)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={30}
              value={form.daysBefore}
              onChange={(e) => setForm({ ...form, daysBefore: Number(e.target.value) })}
              className={cn(inputClass, "w-20 shrink-0")}
            />
            <input
              value={form.beforeTemplate}
              onChange={(e) => setForm({ ...form, beforeTemplate: e.target.value })}
              disabled={form.daysBefore === 0}
              className={cn(inputClass, "disabled:opacity-40")}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">
            Vadesi geçenler — kaç gün sonra? <span className="text-espresso-muted dark:text-cream/40">(0 = kapalı)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={30}
              value={form.daysAfter}
              onChange={(e) => setForm({ ...form, daysAfter: Number(e.target.value) })}
              className={cn(inputClass, "w-20 shrink-0")}
            />
            <input
              value={form.afterTemplate}
              onChange={(e) => setForm({ ...form, afterTemplate: e.target.value })}
              disabled={form.daysAfter === 0}
              className={cn(inputClass, "disabled:opacity-40")}
            />
          </div>
        </div>

        <p className="text-[10px] text-espresso-muted dark:text-cream/40">
          Kullanılabilir alanlar: {"{veli_adi}"}, {"{ogrenci_adi}"}, {"{tutar}"}, {"{son_odeme}"}, {"{taksit_sayisi}"}.
          SMS onayı (KVKK) olmayan velilere gönderim yapılmaz.
        </p>

        <button
          onClick={save}
          disabled={saving}
          className="flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Kaydet
        </button>
      </div>
    </div>
  );
}
