"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, ScanLine } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { OpticalFormatForm } from "./optical-format-form";

export type OpticalSubjectBlockInput = { subject: string; start: number; length: number };
export type OpticalFormat = {
  id: string;
  name: string;
  tcNoStart: number | null;
  tcNoLength: number | null;
  studentNoStart: number | null;
  studentNoLength: number | null;
  bookletStart: number | null;
  bookletLength: number | null;
  gradeStart: number | null;
  gradeLength: number | null;
  branchStart: number | null;
  branchLength: number | null;
  nameStart: number | null;
  nameLength: number | null;
  subjectBlocks: OpticalSubjectBlockInput[];
};

// Optik format tanımlama — edesis'in "Optik Parametreleri" ekranıyla AYNI
// mantık: sabit-genişlikli metin dosyasındaki her alan bir (Başlangıç,
// Uzunluk) çifti (1-tabanlı karakter pozisyonu). Kurum bazlı, birden çok
// sınavda tekrar kullanılır (bkz. prisma > OpticalFormat). Gerçek form
// mantığı OpticalFormatForm'da (bkz. o dosya) — bu bileşen SADECE liste +
// modal kabuğu; "Yeni Deneme Oluştur" sihirbazı da AYNI formu kullanır.
export function OpticalFormatManager({ isOpen, onClose, onSaved }: { isOpen: boolean; onClose: () => void; onSaved: () => void }) {
  const { showError } = useToast();
  const [formats, setFormats] = useState<OpticalFormat[] | null>(null);
  const [editing, setEditing] = useState<OpticalFormat | "new" | null>(null);

  function load() {
    setFormats(null);
    fetch("/api/optical-formats")
      .then((res) => res.json())
      .then((data) => setFormats(data.formats ?? []))
      .catch(() => showError("Optik formatlar yüklenemedi."));
  }

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function remove(id: string) {
    if (!window.confirm("Bu optik format silinsin mi? Onu kullanan geçmiş yüklemeler etkilenmez.")) return;
    try {
      const res = await fetch(`/api/optical-formats/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silinemedi.");
      load();
      onSaved();
    } catch {
      showError("Silinemedi.");
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Optik Format Tanımlama" widthClassName="max-w-2xl">
      {editing === null ? (
        <div className="space-y-3">
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">
            Optik tarayıcının ürettiği sabit-genişlikli metin dosyasında hangi karakter aralığının hangi alana (T.C. No, Ad Soyad, her dersin cevap
            harfleri…) karşılık geldiğini tanımla. Tarayıcı markası/formatı değişmediği sürece bir kez tanımlanır, her sınavda tekrar kullanılır.
          </p>
          <button
            onClick={() => setEditing("new")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 py-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-300"
          >
            <Plus className="h-4 w-4" /> Yeni Optik Format Tanımla
          </button>

          {formats === null ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
          ) : formats.length === 0 ? (
            <p className="rounded-xl border border-dashed border-hairline py-6 text-center text-[11px] text-espresso-muted dark:border-white/10 dark:text-cream/40">
              Henüz optik format tanımlanmadı.
            </p>
          ) : (
            <div className="space-y-1.5">
              {formats.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-white/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
                >
                  <button onClick={() => setEditing(f)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ScanLine className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-espresso dark:text-cream">{f.name}</span>
                      <span className="block text-[10px] text-espresso-muted dark:text-cream/40">{f.subjectBlocks.map((b) => b.subject).join(", ") || "ders bloğu yok"}</span>
                    </span>
                  </button>
                  <button onClick={() => remove(f.id)} className="shrink-0 rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-500/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <OpticalFormatForm
          initial={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            onSaved();
          }}
        />
      )}
    </Modal>
  );
}
