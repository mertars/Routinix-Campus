"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, GraduationCap } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";

type Table = { id: string; name: string; puanTuru: string; rows: { net: number; ranking: number }[] };

// ÖSYM Referans Tabloları — kullanıcı kararı: "ösym sıralama sistemini de
// kuralım". Resmi ÖSYM puanını KENDİMİZ hesaplayamıyoruz (o yılın TÜM
// Türkiye adaylarının istatistiğine dayanır, bu veri ÖSYM'nin kendi elinde);
// bunun yerine kurum, elindeki GERÇEK net→sıralama referans verisini
// (yayınevinden ya da ÖSYM'nin yıl sonu yayınladığı resmi rapordan) buraya
// yapıştırır — karne bu tabloya göre ARA DEĞER (interpolasyon) ile tahmini
// sıralama gösterir.
export function OsymReferenceManager({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { showError, showSuccess } = useToast();
  const [tables, setTables] = useState<Table[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [puanTuru, setPuanTuru] = useState("TYT");
  const [rowsText, setRowsText] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setTables(null);
    fetch("/api/osym-reference-tables")
      .then((r) => r.json())
      .then((d) => setTables(d.tables ?? []))
      .catch(() => showError("Tablolar yüklenemedi."));
  }

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function create() {
    if (!name.trim() || !puanTuru.trim()) return showError("Ad ve puan türü zorunludur.");
    setSaving(true);
    try {
      const res = await fetch("/api/osym-reference-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), puanTuru: puanTuru.trim(), rowsText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      showSuccess("Tablo kaydedildi.");
      setCreating(false);
      setName("");
      setRowsText("");
      load();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Bu referans tablosu silinsin mi?")) return;
    const res = await fetch(`/api/osym-reference-tables/${id}`, { method: "DELETE" });
    if (!res.ok) return showError("Silinemedi.");
    load();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ÖSYM Referans Tabloları" widthClassName="max-w-lg">
      {creating ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
            Elindeki GERÇEK net→sıralama verisini (yayınevi ya da ÖSYM&apos;nin yıl sonu raporundan) yapıştır — biz sayı uydurmuyoruz, sadece
            senin verdiğin iki değer arasında ara değer hesaplıyoruz.
          </p>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-espresso-muted dark:text-cream/40">Tablo Adı</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="örn. 2025 TYT"
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-espresso-muted dark:text-cream/40">Puan Türü</label>
            <input
              value={puanTuru}
              onChange={(e) => setPuanTuru(e.target.value)}
              placeholder="TYT / Sayısal / Eşit Ağırlık / Sözel"
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-espresso-muted dark:text-cream/40">
              Net;Sıralama Satırları <span className="font-normal opacity-70">— her satır bir net-sıralama çifti</span>
            </label>
            <textarea
              value={rowsText}
              onChange={(e) => setRowsText(e.target.value)}
              rows={8}
              placeholder={"90;350\n85;1200\n80;3400\n..."}
              className="w-full resize-y rounded-lg border border-hairline bg-white px-3 py-2 font-mono text-[10.5px] leading-relaxed text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCreating(false)}
              className="flex-1 rounded-xl border border-hairline py-2.5 text-xs font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream"
            >
              Vazgeç
            </button>
            <button
              onClick={create}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Kaydet
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => setCreating(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 py-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-300"
          >
            <Plus className="h-4 w-4" /> Yeni Referans Tablosu
          </button>
          {tables === null ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
          ) : tables.length === 0 ? (
            <p className="rounded-xl border border-dashed border-hairline py-6 text-center text-[11px] text-espresso-muted dark:border-white/10 dark:text-cream/40">
              Henüz tablo yok — eklemezsen karnede tahmini sıralama görünmez.
            </p>
          ) : (
            <div className="space-y-1.5">
              {tables.map((tbl) => (
                <div
                  key={tbl.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-white/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <GraduationCap className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-espresso dark:text-cream">{tbl.name}</span>
                      <span className="block text-[10px] text-espresso-muted dark:text-cream/40">
                        {tbl.puanTuru} · {tbl.rows.length} satır
                      </span>
                    </span>
                  </span>
                  <button onClick={() => remove(tbl.id)} className="shrink-0 rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-500/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
