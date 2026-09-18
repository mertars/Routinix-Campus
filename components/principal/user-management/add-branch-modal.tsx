"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { TRACK_OPTIONS, TRACK_START_GRADE, type Track } from "@/lib/tracks";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Segment = "LGS" | "YKS" | "MEZUN";

const SEGMENT_OPTIONS: { id: Segment; label: string; grades: number[] }[] = [
  { id: "LGS", label: "LGS (Ortaokul)", grades: [5, 6, 7, 8] },
  { id: "YKS", label: "YKS (Lise)", grades: [9, 10, 11, 12] },
  { id: "MEZUN", label: "Mezun", grades: [12] },
];

const inputClass =
  "w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream";

export type NewBranch = { id: string; name: string };

export function AddBranchModal({
  isOpen,
  onClose,
  onCreated,
  apiBase = "/api/admin",
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (branch: NewBranch) => void;
  // Kurum yöneticisi (varsayılan, /api/admin) VE platform sahibi (seçtiği
  // kurum için /api/platform/institutions/{id}) AYNI modalı kullanır — bkz.
  // app/platform/page.tsx > InstitutionManageModal.
  apiBase?: string;
}) {
  const { showError } = useToast();
  const [name, setName] = useState("");
  const [segment, setSegment] = useState<Segment>("YKS");
  const [grade, setGrade] = useState<number>(9);
  const [track, setTrack] = useState<Track | "">("");
  const [submitting, setSubmitting] = useState(false);

  // ⚠️ ALAN ZORUNLU (Mert, 2026-09-18): "11, 12 ve mezun sınıfları
  // açılırken hepsine mecbur alan seçimi koy, alan seçmeden şube
  // açılmasın." Gerekçe: alan bilinmeden o sınıfın SORUMLU DERSLERİ
  // hesaplanamıyor (bkz. lib/tracks.ts) — ders programı, değerlendirme ve
  // çalışma planı hep eksik çıkıyordu. Sonradan doldurulması beklenen bir
  // alan pratikte hiç doldurulmuyor: canlı veride 10 şubenin 10'u da boştu.
  const trackRequired = segment === "MEZUN" || grade >= TRACK_START_GRADE;
  const isValid = name.trim().length > 0 && (!trackRequired || track !== "");

  function resetForm() {
    setName("");
    setSegment("YKS");
    setGrade(9);
    setTrack("");
  }

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, segment, grade, track: track || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Şube oluşturulamadı.");
      onCreated(data.branch);
      resetForm();
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Şube oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yeni Şube Ekle">
      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Şube Adı (örn. "12-A VIP")'
          className={inputClass}
        />

        <div className="flex gap-1.5 rounded-xl bg-cream-card p-1 dark:bg-white/5">
          {SEGMENT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setSegment(option.id);
                setGrade(option.grades[option.grades.length - 1]);
              }}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-medium transition",
                segment === option.id ? "bg-espresso text-cream dark:bg-brand-600" : "text-espresso-muted dark:text-cream/40"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">
            Sınıf Seviyesi
          </label>
          <select value={grade} onChange={(e) => setGrade(Number(e.target.value))} className={inputClass}>
            {SEGMENT_OPTIONS.find((s) => s.id === segment)?.grades.map((g) => (
              <option key={g} value={g}>{g}. Sınıf</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">
            Alan {trackRequired ? <span className="text-rose-600">(zorunlu)</span> : "(isteğe bağlı)"}
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {TRACK_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setTrack(track === option.id ? "" : option.id)}
                title={option.hint}
                className={cn(
                  "rounded-lg px-2.5 py-2 text-left text-[11.5px] font-medium transition",
                  track === option.id
                    ? "bg-espresso text-cream dark:bg-brand-600"
                    : "bg-cream-card text-espresso-muted hover:text-espresso dark:bg-white/5 dark:text-cream/45"
                )}
              >
                <span className="block">{option.label}</span>
                <span className={cn("block text-[9.5px] leading-tight", track === option.id ? "text-cream/70" : "text-espresso-muted/70 dark:text-cream/30")}>
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
          {trackRequired && track === "" && (
            <p className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400">
              {grade}. sınıf için alan seçimi zorunlu — sorumlu dersler buna göre belirleniyor.
            </p>
          )}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!isValid || submitting}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {submitting ? "Oluşturuluyor..." : "Şubeyi Oluştur"}
      </button>
    </Modal>
  );
}
