"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, UserX, UserCheck } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

export type DeactivateTarget = { id: string; role: "STUDENT" | "TEACHER"; name: string; isActive: boolean } | null;

// Hard delete YOK — bkz. prisma/schema.prisma > Student.isActive'teki
// gerekçe. Bu modal HEM pasifleştirme HEM (pasif bir kayıt seçildiğinde)
// geri aktifleştirme için kullanılır — aynı onay deseni, ters yönde.
export function DeactivateConfirmModal({
  target,
  onClose,
  onChanged,
  apiBase = "/api/admin",
}: {
  target: DeactivateTarget;
  onClose: () => void;
  onChanged: () => void;
  // bkz. add-branch-modal.tsx'teki aynı not.
  apiBase?: string;
}) {
  const { showError, showSuccess } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (!target) return;
    setSubmitting(true);
    const action = target.isActive ? "deactivate" : "reactivate";
    try {
      const res = await fetch(`${apiBase}/users/${target.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: target.role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "İşlem başarısız.");
      showSuccess(target.isActive ? `${target.name} pasifleştirildi.` : `${target.name} tekrar aktif edildi.`);
      onChanged();
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "İşlem başarısız.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={!!target} onClose={onClose} title={target?.isActive ? "Üyeliği Sonlandır" : "Tekrar Aktif Et"} variant="center">
      {target && (
        <div className="space-y-4">
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl p-4",
              target.isActive ? "bg-rose-50 dark:bg-rose-500/10" : "bg-green-50 dark:bg-green-500/10"
            )}
          >
            <AlertTriangle className={cn("mt-0.5 h-5 w-5 shrink-0", target.isActive ? "text-rose-600 dark:text-rose-400" : "text-green-600 dark:text-green-400")} />
            <div className="text-sm text-espresso dark:text-cream">
              <p className="font-medium">
                {target.name} {target.isActive ? "pasifleştirilecek." : "tekrar aktif edilecek."}
              </p>
              <p className="mt-1 text-xs text-espresso-muted dark:text-cream/50">
                {target.isActive
                  ? "Giriş yapamaz olur, kadro listesinden düşer — not/devamsızlık gibi geçmiş kayıtları SİLİNMEZ, korunur. İstersen daha sonra tekrar aktif edebilirsin."
                  : "Tekrar giriş yapabilir hale gelir ve kadro listesinde görünür — kimlik bilgileri (T.C. No, öğrenci no vb.) değişmez."}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-hairline py-2.5 text-sm font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
            >
              Vazgeç
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-50",
                target.isActive ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : target.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
              {submitting ? "İşleniyor..." : target.isActive ? "Evet, Pasifleştir" : "Evet, Aktifleştir"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
