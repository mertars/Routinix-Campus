"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Modal } from "@/components/ui/modal";
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

export function AddBranchModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: (branch: NewBranch) => void }) {
  const { showError } = useToast();
  const [name, setName] = useState("");
  const [segment, setSegment] = useState<Segment>("YKS");
  const [grade, setGrade] = useState<number>(9);
  const [track, setTrack] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValid = name.trim().length > 0;

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
      const res = await fetch("/api/admin/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, segment, grade, track: track.trim() || undefined }),
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

        <input value={track} onChange={(e) => setTrack(e.target.value)} placeholder="Alan/Dal (isteğe bağlı — Sayısal, Eşit Ağırlık vb.)" className={inputClass} />
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
