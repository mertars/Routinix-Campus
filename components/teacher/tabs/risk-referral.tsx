"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, LifeBuoy, CheckCircle2, Loader2, Send } from "lucide-react";
import { RISK_REASON_LABEL, type RiskReason } from "@/lib/mock-data";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type RiskEntry = { id: string; name: string; branch: string; riskScore: number; reason: RiskReason };

// Rehberliğe sevk için kısa bir not (reason) isteyen modal — GuidanceReferral
// kaydı (studentId, teacherId, reason, status: PENDING) bu notla oluşturulur.
// GuidanceNote'taki sabit metinli eski akıştan BİLEREK ayrı: burada gerçek
// bir öğretmen gözlemi zorunlu, kayıt PENDING/REVIEWED olarak takip edilebilir
// (bkz. app/api/guidance-referrals/route.ts).
function ReferralReasonModal({
  target,
  submitting,
  onClose,
  onSubmit,
}: {
  target: RiskEntry | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!target) setReason("");
  }, [target]);

  return (
    <Modal isOpen={!!target} onClose={onClose} title="Rehberliğe Sevk Et">
      {target && (
        <div className="space-y-3">
          <p className="rounded-xl bg-cream-card px-3 py-2.5 text-xs text-espresso dark:bg-white/5 dark:text-cream">
            {target.name} · {target.branch}
          </p>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Sevk gerekçeni kısaca yaz (örn. Son iki denemede net düşüşü ve tekrarlayan devamsızlık)."
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />
          <button
            onClick={() => onSubmit(reason)}
            disabled={!reason.trim() || submitting}
            className="flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Sevki Gönder
          </button>
        </div>
      )}
    </Modal>
  );
}

export function RiskReferralTab() {
  const { staffRecord } = useTeacherScope();
  const { showError, showSuccess } = useToast();
  const [risky, setRisky] = useState<RiskEntry[]>([]);
  const [referred, setReferred] = useState<string[]>([]);
  const [referTarget, setReferTarget] = useState<RiskEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!staffRecord.id) return;
    fetch(`/api/risk-radar?teacherId=${encodeURIComponent(staffRecord.id)}`)
      .then((res) => res.json())
      .then((data) => setRisky((data.entries ?? []).filter((e: RiskEntry) => e.riskScore >= 30)))
      .catch(() => showError("Risk verisi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffRecord.id]);

  async function submitReferral(reason: string) {
    if (!referTarget || !reason.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/guidance-referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: referTarget.id, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sevk gönderilemedi.");
      setReferred((prev) => [...prev, referTarget.id]);
      showSuccess(`${referTarget.name} rehberliğe sevk edildi.`);
      setReferTarget(null);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Sevk gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <AlertTriangle className="h-4 w-4 text-brand-600" /> Rehberlik Sevk & Risk Alarmı
        </h2>
        <div className="space-y-2">
          {risky.map((entry, index) => {
            const isReferred = referred.includes(entry.id);
            const isHigh = entry.riskScore >= 70;
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-xl border-l-4 px-3 py-2.5",
                  isHigh ? "border-rose-500 bg-rose-50/60 dark:bg-rose-500/10" : "border-brand-500 bg-cream-card dark:bg-white/5"
                )}
              >
                <div>
                  <p className="text-sm font-medium text-espresso dark:text-cream">{entry.name}</p>
                  <p className="text-[11px] text-espresso-muted dark:text-cream/40">
                    {entry.branch} · {RISK_REASON_LABEL[entry.reason]} · Risk {entry.riskScore}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReferTarget(entry)}
                    disabled={isReferred}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                      isReferred
                        ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                        : "bg-espresso text-cream hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
                    )}
                  >
                    {isReferred ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" /> Sevk Edildi
                      </>
                    ) : (
                      <>
                        <LifeBuoy className="h-3 w-3" /> Rehberliğe Sevk Et
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
          {risky.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Girdiğiniz sınıflarda risk uyarısı yok.</p>}
        </div>
      </motion.div>

      <ReferralReasonModal target={referTarget} submitting={submitting} onClose={() => setReferTarget(null)} onSubmit={submitReferral} />
    </div>
  );
}
