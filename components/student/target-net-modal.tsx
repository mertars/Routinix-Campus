"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Target } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";

type Segment = "LGS" | "YKS" | "MEZUN";

export type TargetNetValues = { targetNet: number | null; targetNetTyt: number | null; targetNetAyt: number | null };

function NumberField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={200}
        step={0.25}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-hairline bg-white px-3.5 py-2.5 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
      />
    </label>
  );
}

export function TargetNetModal({
  isOpen,
  onClose,
  studentId,
  segment,
  initial,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  segment: Segment;
  initial: TargetNetValues;
  onSaved: (next: TargetNetValues) => void;
}) {
  const { showError, showSuccess } = useToast();
  const [tyt, setTyt] = useState("");
  const [ayt, setAyt] = useState("");
  const [single, setSingle] = useState("");
  const [saving, setSaving] = useState(false);
  const isYks = segment === "YKS";

  useEffect(() => {
    if (!isOpen) return;
    setTyt(initial.targetNetTyt !== null ? String(initial.targetNetTyt) : "");
    setAyt(initial.targetNetAyt !== null ? String(initial.targetNetAyt) : "");
    setSingle(initial.targetNet !== null ? String(initial.targetNet) : "");
  }, [isOpen, initial]);

  async function save() {
    setSaving(true);
    try {
      const body = isYks
        ? { targetNetTyt: tyt.trim() === "" ? null : Number(tyt), targetNetAyt: ayt.trim() === "" ? null : Number(ayt) }
        : { targetNet: single.trim() === "" ? null : Number(single) };

      const res = await fetch(`/api/students/${encodeURIComponent(studentId)}/target-net`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Hedef net kaydedilemedi.");
      onSaved({ targetNet: data.targetNet, targetNetTyt: data.targetNetTyt, targetNetAyt: data.targetNetAyt });
      showSuccess("Hedef netin güncellendi.");
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Hedef net kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Hedef Netini Belirle">
      <div className="space-y-4">
        <p className="flex items-start gap-1.5 text-xs text-espresso-muted dark:text-cream/40">
          <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
          {isYks
            ? "TYT ve AYT hedef netlerini ayrı ayrı gir — Net & Derece Takipçisi'ndeki toplam hedef bunların toplamı olarak gösterilir."
            : "Bu dönem ulaşmayı hedeflediğin neti gir."}
        </p>

        {isYks ? (
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="TYT Hedef Net" placeholder="örn. 90" value={tyt} onChange={setTyt} />
            <NumberField label="AYT Hedef Net" placeholder="örn. 60" value={ayt} onChange={setAyt} />
          </div>
        ) : (
          <NumberField label={`${segment} Hedef Net`} placeholder="örn. 75" value={single} onChange={setSingle} />
        )}

        <button
          onClick={save}
          disabled={saving}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-70 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </Modal>
  );
}
