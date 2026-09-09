"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutTemplate, Save, Trash2, Loader2, Check, X } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import type { TemplateModule } from "@/lib/templates/catalog";

export type TemplateRow = {
  id: string;
  module: TemplateModule;
  name: string;
  description: string | null;
  payload: Record<string, unknown>;
  isBuiltIn: boolean;
  usageCount: number;
};

// Herhangi bir formun üstüne takılan şablon çubuğu.
//
// Tek bir bileşen, tüm modüller: hazır şablonlar koddan, kurumun kendi
// şablonları veritabanından gelir ve ikisi aynı listede görünür
// (bkz. lib/templates/catalog.ts). Form kendi alanlarını bilmek
// zorunda değil — payload'ı alır, kendi state'ine yazar.
//
// getCurrent verilirse "Şablon olarak kaydet" düğmesi çıkar: müdür bir
// kez doldurduğu formu bir daha doldurmaz.
export function TemplateBar({
  module,
  onApply,
  getCurrent,
  className,
}: {
  module: TemplateModule;
  onApply: (payload: Record<string, unknown>) => void;
  /** Formun o anki hali — null dönerse kaydetme düğmesi pasif olur. */
  getCurrent?: () => Record<string, unknown> | null;
  className?: string;
}) {
  const { showError, showSuccess } = useToast();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/templates?module=${module}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Şablonlar alınamadı.");
      setTemplates(data.templates ?? []);
    } catch {
      // Şablon çubuğu yardımcı bir katman — yüklenemezse formun kendisi
      // çalışmaya devam etmeli, ekranı hata mesajıyla kaplamamalı.
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    void load();
  }, [load]);

  function apply(t: TemplateRow) {
    onApply(t.payload);
    setAppliedId(t.id);
    // Sayaç arka planda; başarısız olsa da uygulama akışı bozulmaz.
    void fetch(`/api/templates?used=${encodeURIComponent(t.id)}`, { method: "POST" }).catch(() => {});
    setTimeout(() => setAppliedId(null), 1500);
  }

  async function save() {
    const payload = getCurrent?.();
    if (!payload) {
      showError("Kaydedilecek bir içerik yok — önce formu doldurun.");
      return;
    }
    const name = savingName?.trim();
    if (!name) return;

    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, name, payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Şablon kaydedilemedi.");
      showSuccess(`"${name}" şablon olarak kaydedildi.`);
      setSavingName(null);
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Şablon kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: TemplateRow) {
    try {
      const res = await fetch(`/api/templates?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Şablon silinemedi.");
      showSuccess(`"${t.name}" silindi.`);
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Şablon silinemedi.");
    }
  }

  if (loading && templates.length === 0) return null;

  return (
    <div className={cn("rounded-xl border border-hairline bg-cream-card p-2.5 dark:border-white/10 dark:bg-white/5", className)}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <LayoutTemplate className="h-3.5 w-3.5 text-brand-600" />
        <span className="text-[11px] font-medium text-espresso dark:text-cream">Şablonlar</span>
        <span className="text-[11px] text-espresso-muted dark:text-cream/40">— birine tıklayın, formu doldursun</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {templates.map((t) => (
          <span key={t.id} className="group relative inline-flex">
            <button
              type="button"
              onClick={() => apply(t)}
              title={t.description ?? undefined}
              className={cn(
                "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition",
                appliedId === t.id
                  ? "border-green-600 bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                  : t.isBuiltIn
                    ? "border-hairline bg-white text-espresso hover:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                    : "border-brand-600/40 bg-brand-50 text-brand-700 hover:border-brand-600 dark:bg-brand-600/15 dark:text-brand-300"
              )}
            >
              {appliedId === t.id && <Check className="h-3 w-3" />}
              {t.name}
              {!t.isBuiltIn && t.usageCount > 0 && (
                <span className="text-[10px] opacity-60">· {t.usageCount}</span>
              )}
            </button>
            {/* Hazır şablonlar silinemez — düğme yalnızca kurumunkilerde. */}
            {!t.isBuiltIn && (
              <button
                type="button"
                onClick={() => remove(t)}
                aria-label={`${t.name} şablonunu sil`}
                className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white group-hover:flex"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        ))}
      </div>

      {getCurrent && (
        <div className="mt-2 flex items-center gap-1.5">
          {savingName === null ? (
            <button
              type="button"
              onClick={() => setSavingName("")}
              className="flex items-center gap-1 rounded-lg border border-dashed border-hairline px-2.5 py-1 text-[11px] font-medium text-espresso-muted transition hover:border-brand-600 hover:text-brand-600 dark:border-white/20 dark:text-cream/40"
            >
              <Save className="h-3 w-3" /> Şu anki hali şablon olarak kaydet
            </button>
          ) : (
            <>
              <input
                autoFocus
                value={savingName}
                onChange={(e) => setSavingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save();
                  if (e.key === "Escape") setSavingName(null);
                }}
                placeholder="Şablon adı..."
                className="flex-1 rounded-lg border border-hairline bg-white px-2 py-1 text-[11px] text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
              />
              <button
                type="button"
                onClick={save}
                disabled={saving || !savingName.trim()}
                className="flex items-center gap-1 rounded-lg bg-espresso px-2.5 py-1 text-[11px] font-medium text-cream disabled:opacity-40 dark:bg-brand-600"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Kaydet
              </button>
              <button
                type="button"
                onClick={() => setSavingName(null)}
                aria-label="Vazgeç"
                className="rounded-lg border border-hairline px-1.5 py-1 text-espresso-muted dark:border-white/10 dark:text-cream/40"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
