"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Minus, Plus, Save, Trash2, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { createTemplateLayout, type ClassroomLayout, type Desk, type LayoutTemplate } from "@/lib/seating/types";
import { cn } from "@/lib/utils";

const TEMPLATES: { id: LayoutTemplate; label: string }[] = [
  { id: "2li", label: "2'li Dizilim" },
  { id: "3lu", label: "3'lü Dizilim" },
  { id: "4lu", label: "4'lü Dizilim" },
  { id: "u", label: "U Düzeni" },
];

const DESK_WIDTH = 150;
const DESK_HEIGHT = 88;

// Sürükle-bırak kroki editörü — masalar SERBEST x/y konumunda (bkz.
// lib/seating/types.ts'teki gerekçe: sabit ızgara U-düzenini
// temsil edemez). Her sürüklemede ANINDA kaydetmiyoruz — yalnızca yerel
// state güncellenir, "Kaydet" tek seferde PATCH atar.
export function KrokiEditorModal({
  classroomId,
  classroomName,
  onClose,
  onSaved,
}: {
  classroomId: string | null;
  classroomName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [desks, setDesks] = useState<Desk[]>([]);
  const [pendingTemplate, setPendingTemplate] = useState<LayoutTemplate | null>(null);

  useEffect(() => {
    if (!classroomId) return;
    setLoading(true);
    setPendingTemplate(null);
    fetch(`/api/admin/classrooms/${classroomId}`)
      .then((res) => res.json())
      .then((data: { classroom?: { layout: ClassroomLayout }; error?: string }) => {
        if (!data.classroom) throw new Error(data.error ?? "Sınıf yüklenemedi.");
        setDesks(data.classroom.layout.desks);
      })
      .catch((error) => showError(error instanceof Error ? error.message : "Sınıf yüklenemedi."))
      .finally(() => setLoading(false));
  }, [classroomId, showError]);

  function handleDragEnd(deskId: string, offsetX: number, offsetY: number) {
    setDesks((prev) => prev.map((d) => (d.id === deskId ? { ...d, x: Math.max(0, d.x + offsetX), y: Math.max(0, d.y + offsetY) } : d)));
  }

  function addDesk() {
    const index = desks.length;
    setDesks((prev) => [
      ...prev,
      { id: `desk-${Date.now()}-${index}`, x: 24 + (index % 4) * 40, y: 24 + Math.floor(index / 4) * 40, seatCount: 2 },
    ]);
  }

  function removeDesk(deskId: string) {
    setDesks((prev) => prev.filter((d) => d.id !== deskId));
  }

  function changeSeatCount(deskId: string, delta: number) {
    setDesks((prev) => prev.map((d) => (d.id === deskId ? { ...d, seatCount: Math.min(4, Math.max(1, d.seatCount + delta)) } : d)));
  }

  function applyTemplate(template: LayoutTemplate) {
    setDesks(createTemplateLayout(template).desks);
    setPendingTemplate(null);
  }

  async function handleSave() {
    if (!classroomId) return;
    if (desks.length === 0) {
      showError("Krokide en az bir masa olmalı.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/classrooms/${classroomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: { desks } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      showSuccess("Kroki kaydedildi.");
      onSaved();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  const totalSeats = desks.reduce((sum, d) => sum + d.seatCount, 0);

  return (
    <Modal isOpen={!!classroomId} onClose={onClose} title={`Kroki Editörü — ${classroomName}`} variant="center" widthClassName="max-w-4xl">
      {loading ? (
        <div className="flex items-center justify-center py-16 text-espresso-muted dark:text-cream/40">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPendingTemplate(t.id)}
                  className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-espresso-muted transition hover:border-brand-600/50 hover:text-espresso dark:border-white/10 dark:text-cream/40 dark:hover:text-cream"
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={addDesk}
              className="flex items-center gap-1.5 rounded-full bg-espresso px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              <Plus className="h-3.5 w-3.5" /> Masa Ekle
            </button>
          </div>

          {pendingTemplate && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-300"
            >
              <span>Bu, mevcut krokideki tüm masaları silip şablonu uygular. Emin misin?</span>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => setPendingTemplate(null)} className="rounded-lg px-2.5 py-1 font-medium hover:bg-amber-100 dark:hover:bg-amber-500/10">
                  Vazgeç
                </button>
                <button
                  onClick={() => applyTemplate(pendingTemplate)}
                  className="rounded-lg bg-amber-600 px-2.5 py-1 font-semibold text-white hover:bg-amber-700"
                >
                  Uygula
                </button>
              </div>
            </motion.div>
          )}

          <p className="text-xs text-espresso-muted dark:text-cream/40">
            {desks.length} masa · {totalSeats} koltuk — masaları sürükleyerek istediğin düzeni oluştur.
          </p>

          <div className="relative h-[420px] w-full overflow-auto rounded-2xl border-2 border-dashed border-hairline bg-cream-card/40 dark:border-white/10 dark:bg-midnight/40">
            <div className="relative" style={{ width: 1300, height: 700 }}>
              {/* NOT: masalar KENDİ AnimatePresence'ı içinde — şablon
                  butonları (bkz. applyTemplate) mevcut masaların bir
                  kısmını kaldırıp yenilerini eklediğinde, bu sürükle-
                  bırak edilebilir motion.div'lerin kaldırılması bir üst
                  Modal'ın AnimatePresence'ına "yalın" (izlenmeyen) bir
                  unmount olarak sızıyordu — canlı testte doğrulanan gerçek
                  bir hata: Modal kapatılınca çıkış animasyonu asla
                  tamamlanmıyor, görünmez ama tıklamaları hâlâ yakalayan bir
                  DOM artığı kalıyordu. Masaları kendi AnimatePresence'ları
                  altına almak (basit bir exit ile) bu kaldırmaları
                  İZLENEN bir çıkışa çevirir, üst Modal'ın kendi çıkış
                  takibini bozmaz. */}
              <AnimatePresence>
                {desks.map((desk) => (
                <motion.div
                  key={desk.id}
                  drag
                  dragMomentum={false}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onDragEnd={(_, info) => handleDragEnd(desk.id, info.offset.x, info.offset.y)}
                  // NOT: konum "animate" ile DEĞİL "style.x/y" ile veriliyor —
                  // "drag" aktifken "animate" ile aynı x/y'yi de vermek,
                  // framer-motion'ın konumu drag'in KENDİ iç motion value'suna
                  // (mount'ta 0'dan başlayan) bırakmasına yol açıyor; tüm
                  // masalar (0,0)'da ÜST ÜSTE render ediliyordu (Puppeteer ile
                  // yakalanan gerçek bir bug — her masanın getBoundingClientRect
                  // sonucu birebir aynıydı). style.x/y ise drag'in okuyup
                  // yazdığı AYNI motion value'yu besler, tutarlı kalır.
                  style={{ position: "absolute", left: 0, top: 0, width: DESK_WIDTH, height: DESK_HEIGHT, x: desk.x, y: desk.y }}
                  className="cursor-grab select-none rounded-xl border border-hairline bg-white p-2 shadow-sm active:cursor-grabbing dark:border-white/10 dark:bg-midnight-card"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => changeSeatCount(desk.id, -1)}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-espresso-muted hover:bg-cream-card dark:text-cream/40 dark:hover:bg-white/10"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-4 text-center text-xs font-semibold text-espresso dark:text-cream">{desk.seatCount}</span>
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => changeSeatCount(desk.id, 1)}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-espresso-muted hover:bg-cream-card dark:text-cream/40 dark:hover:bg-white/10"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => removeDesk(desk.id)}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-espresso-muted hover:bg-red-100 hover:text-red-600 dark:text-cream/40 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {Array.from({ length: desk.seatCount }).map((_, i) => (
                      <span key={i} className={cn("h-4 flex-1 rounded-md bg-brand-100 dark:bg-brand-600/20")} />
                    ))}
                  </div>
                </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-hairline px-4 py-2.5 text-sm font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
            >
              Vazgeç
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-espresso px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Kaydediliyor..." : "Krokiyi Kaydet"}
            </button>
          </div>
        </div>
      )}
      {!loading && desks.length === 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <Trash2 className="h-3.5 w-3.5" /> Krokide hiç masa yok — en az bir masa eklemeden kaydedemezsin.
        </p>
      )}
    </Modal>
  );
}
