"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, LifeBuoy, CheckCircle2, Loader2, Send, UserPlus } from "lucide-react";
import { RISK_REASON_LABEL, type RiskReason } from "@/lib/mock-data";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { Modal } from "@/components/ui/modal";
import { StudentSearchPicker, type PickableStudent } from "@/components/teacher/student-search-picker";
import { cn } from "@/lib/utils";

type RiskEntry = { id: string; name: string; branch: string; riskScore: number; reason: RiskReason };

// Kullanıcı talebi: "öğretmen istediği öğrenciyi de rehberliğe sevk
// edebilsin" — eskiden sevk butonu SADECE risk radarının otomatik
// işaretlediği öğrencilerde vardı, öğretmen kendi gözlemiyle bambaşka bir
// öğrenciyi (risk radarında hiç görünmese bile) sevk edemiyordu. Backend
// zaten herhangi bir öğrenciyi kabul ediyordu (assertTeacherOwnsStudent) —
// eksik olan sadece bu manuel seçim UI'ıydı.
function ManualReferralCard({ onSubmit, submitting }: { onSubmit: (studentId: string, reason: string) => Promise<boolean>; submitting: boolean }) {
  const { assignedBranches } = useTeacherScope();
  const { showError } = useToast();
  const [students, setStudents] = useState<PickableStudent[]>([]);
  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (assignedBranches.length === 0) return;
    fetch(`/api/students?branchIds=${assignedBranches.map((b) => b.id).join(",")}`)
      .then((res) => res.json())
      .then((data) => setStudents(data.students ?? []))
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedBranches.map((b) => b.id).join(",")]);

  async function submit() {
    if (!studentId || !reason.trim()) return;
    const ok = await onSubmit(studentId, reason.trim());
    if (ok) {
      setStudentId("");
      setReason("");
    }
  }

  return (
    <motion.div
      whileHover={{ scale: 1.005, y: -2 }}
      className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <UserPlus className="h-4 w-4 text-brand-600" /> Manuel Sevk
      </h2>
      <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">
        Risk radarında görünmeyen ama kendi gözlemine göre rehberliğe yönlendirmek istediğin bir öğrenci varsa buradan sevk edebilirsin.
      </p>
      <div className="space-y-2">
        <StudentSearchPicker students={students} selectedId={studentId} onSelect={setStudentId} />
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          placeholder="Sevk gerekçeni kısaca yaz"
          className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />
        <button
          onClick={submit}
          disabled={!studentId || !reason.trim() || submitting}
          className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Sevki Gönder
        </button>
      </div>
    </motion.div>
  );
}

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

  const [manualSubmitting, setManualSubmitting] = useState(false);
  async function submitManualReferral(studentId: string, reason: string): Promise<boolean> {
    setManualSubmitting(true);
    try {
      const res = await fetch("/api/guidance-referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sevk gönderilemedi.");
      showSuccess("Öğrenci rehberliğe sevk edildi.");
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : "Sevk gönderilemedi.");
      return false;
    } finally {
      setManualSubmitting(false);
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

      <ManualReferralCard onSubmit={submitManualReferral} submitting={manualSubmitting} />

      <ReferralReasonModal target={referTarget} submitting={submitting} onClose={() => setReferTarget(null)} onSubmit={submitReferral} />
    </div>
  );
}
