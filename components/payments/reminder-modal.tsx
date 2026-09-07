"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Send, MessageSquare, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type ReminderTarget = {
  studentId: string;
  studentName: string;
  totalRemaining: number;
  oldestDueDate: string;
  installmentCount: number;
  lastReminderAt: string | null;
  isReachable: boolean;
};

type PreviewData = {
  defaultTemplate: string;
  smsCredits: number;
  recipientCount: number;
  targets: ReminderTarget[];
};

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "az önce";
  if (hours < 24) return `${hours} saat önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

// Gecikmiş ödeme hatırlatma SMS'i. Gönderimden ÖNCE kimin alacağı, kaç
// kontör gideceği ve mesajın son hali gösterilir — yönetici "gönder"e
// bastığında sürpriz olmaz.
export function ReminderModal({ isOpen, onClose, onSent }: { isOpen: boolean; onClose: () => void; onSent: () => void }) {
  const { showError, showSuccess } = useToast();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPreview(null);
    fetch("/api/payments/principal/reminders")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: PreviewData) => {
        setPreview(data);
        setMessage(data.defaultTemplate);
        setSelected(new Set(data.targets.filter((t) => t.isReachable).map((t) => t.studentId)));
      })
      .catch(() => showError("Hatırlatma önizlemesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const reachableSelectedCount = useMemo(() => {
    if (!preview) return 0;
    return preview.targets.filter((t) => t.isReachable && selected.has(t.studentId)).length;
  }, [preview, selected]);

  function toggle(studentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function handleSend() {
    if (reachableSelectedCount === 0) return showError("En az bir alıcı seçin.");
    setSending(true);
    try {
      const res = await fetch("/api/payments/principal/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [...selected], messageBody: message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error);
      }
      const data = await res.json();
      showSuccess(`${data.recipientCount} veliye hatırlatma gönderildi. Kalan kontör: ${data.remainingCredits}`);
      onSent();
      onClose();
    } catch (err) {
      showError(err instanceof Error && err.message ? err.message : "Hatırlatma gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  const notEnoughCredits = preview != null && preview.smsCredits < reachableSelectedCount;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ödeme Hatırlatma Gönder" variant="center" widthClassName="max-w-lg">
      {!preview ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : preview.targets.length === 0 ? (
        <p className="py-8 text-center text-sm text-espresso-muted dark:text-cream/40">Gecikmiş ödemesi olan öğrenci yok 🎉</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Mesaj</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
            <p className="mt-1 text-[10px] text-espresso-muted dark:text-cream/40">
              Kullanılabilir alanlar: {"{veli_adi}"}, {"{ogrenci_adi}"}, {"{tutar}"}, {"{son_odeme}"}, {"{taksit_sayisi}"} — her veliye kendi tutarı gider.
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-espresso dark:text-cream">Alıcılar ({reachableSelectedCount} seçili)</p>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {preview.targets.map((t) => {
                const isSelected = selected.has(t.studentId);
                return (
                  <button
                    key={t.studentId}
                    onClick={() => t.isReachable && toggle(t.studentId)}
                    disabled={!t.isReachable}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition",
                      !t.isReachable ? "cursor-not-allowed opacity-50" : isSelected ? "bg-emerald-500/10" : "hover:bg-cream-card dark:hover:bg-white/5"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-espresso dark:text-cream">{t.studentName}</span>
                      <span className="block truncate text-[10px] text-espresso-muted dark:text-cream/40">
                        {formatTRY(t.totalRemaining)} · {t.installmentCount} taksit
                        {!t.isReachable && " · SMS onayı yok"}
                        {t.lastReminderAt && ` · ${relativeTime(t.lastReminderAt)} hatırlatıldı`}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {t.lastReminderAt && <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
                      {isSelected && t.isReachable && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px]",
              notEnoughCredits ? "border-rose-400/30 bg-rose-500/5 text-rose-700 dark:text-rose-300" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/40"
            )}
          >
            {notEnoughCredits ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <MessageSquare className="h-3.5 w-3.5 shrink-0" />}
            {reachableSelectedCount} SMS gidecek · mevcut kontör: {preview.smsCredits}
            {notEnoughCredits && " — yetersiz"}
          </div>

          <button
            onClick={handleSend}
            disabled={sending || reachableSelectedCount === 0 || notEnoughCredits}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {reachableSelectedCount} Veliye Gönder
          </button>
        </div>
      )}
    </Modal>
  );
}
