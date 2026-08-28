"use client";

import { useState } from "react";
import { AlertOctagon, Loader2, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";

export type PermanentDeleteTarget = { id: string; role: "STUDENT" | "TEACHER"; name: string } | null;

// GERİ ALINAMAZ silme — bkz. lib/server/admin/update-user.ts >
// deleteUserAccountPermanently içindeki gerekçe. DeactivateConfirmModal'dan
// BİLEREK ayrı: burada tek tık yetmez, adı YAZARAK onaylatan daha ağır bir
// eşik var (GitHub'ın repo silme deseniyle aynı mantık) — yanlışlıkla
// tıklanan bir "kalıcı sil" düğmesi telafisi olmayan bir hata olur.
export function PermanentDeleteConfirmModal({
  target,
  onClose,
  onDeleted,
  apiBase = "/api/admin",
}: {
  target: PermanentDeleteTarget;
  onClose: () => void;
  onDeleted: () => void;
  // bkz. add-branch-modal.tsx'teki aynı not.
  apiBase?: string;
}) {
  const { showError, showSuccess } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isMatch = target ? confirmText.trim() === target.name.trim() : false;

  function handleClose() {
    setConfirmText("");
    onClose();
  }

  async function handleConfirm() {
    if (!target || !isMatch) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/users/${target.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: target.role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Silinemedi.");
      showSuccess(`${target.name} kalıcı olarak silindi.`);
      onDeleted();
      handleClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Silinemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={!!target} onClose={handleClose} title="Kalıcı Olarak Sil" variant="center">
      {target && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 dark:bg-red-500/10">
            <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <div className="text-sm text-espresso dark:text-cream">
              <p className="font-semibold text-red-700 dark:text-red-400">Bu işlem GERİ ALINAMAZ.</p>
              <p className="mt-1 text-xs text-espresso-muted dark:text-cream/50">
                {target.name} ve tüm geçmişi (notlar, devamsızlık, ödevler, sınav sonuçları, rehberlik notları vb.) veritabanından kalıcı olarak
                silinecek. Emin değilsen &quot;Pasifleştir&quot; kullan — o geri alınabilir, bu değil.
              </p>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso-muted dark:text-cream/40">
              Onaylamak için tam adını yaz: <span className="font-mono font-semibold text-espresso dark:text-cream">{target.name}</span>
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={target.name}
              className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-red-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="flex-1 rounded-xl border border-hairline py-2.5 text-sm font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
            >
              Vazgeç
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isMatch || submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {submitting ? "Siliniyor..." : "Kalıcı Olarak Sil"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
