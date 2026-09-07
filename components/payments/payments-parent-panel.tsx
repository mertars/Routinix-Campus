"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, Clock, AlertTriangle, XCircle, HandCoins, Wallet } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type ParentStudent = { id: string; firstName: string; lastName: string; branchName: string };
type InstallmentRow = {
  id: string;
  title: string;
  amount: number;
  remainingAmount: number;
  dueDate: string;
  status: "PENDING" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  isOverdue: boolean;
};
type PaymentRow = { id: string; amount: number; method: string; accountName: string; paidAt: string };

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

const METHOD_LABEL: Record<string, string> = { CASH: "Nakit", BANK_TRANSFER: "Havale/EFT", CREDIT_CARD: "Kredi Kartı" };

const STATUS_META: Record<InstallmentRow["status"], { label: string; className: string; icon: typeof Clock }> = {
  PENDING: { label: "Bekliyor", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300", icon: Clock },
  PARTIALLY_PAID: { label: "Kısmi Ödendi", className: "bg-sky-500/10 text-sky-700 dark:text-sky-300", icon: Clock },
  PAID: { label: "Ödendi", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 },
  CANCELLED: { label: "İptal", className: "bg-gray-500/10 text-gray-600 dark:text-gray-400", icon: XCircle },
};

// Veli görünümü — SALT OKUNUR (bkz. /api/payments/parent; ödeme alma akışı
// Faz 2'de gerçek gateway ile gelecek, şu an veli sadece borcunu/geçmişini
// görüntüler).
export function PaymentsParentPanel() {
  const { showError } = useToast();
  const [students, setStudents] = useState<ParentStudent[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [installments, setInstallments] = useState<InstallmentRow[] | null>(null);
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);

  useEffect(() => {
    fetch("/api/parent/me")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => {
        const list: ParentStudent[] = data.students ?? [];
        setStudents(list);
        if (list[0]) setSelectedId(list[0].id);
      })
      .catch(() => showError("Öğrenci bilgileri yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setInstallments(null);
    setPayments(null);
    fetch(`/api/payments/parent?studentId=${encodeURIComponent(selectedId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => {
        setInstallments(data.installments ?? []);
        setPayments(data.payments ?? []);
      })
      .catch(() => showError("Ödeme bilgileri yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const totalRemaining = (installments ?? []).filter((i) => i.status !== "PAID" && i.status !== "CANCELLED").reduce((sum, i) => sum + i.remainingAmount, 0);
  const overdueRemaining = (installments ?? []).filter((i) => i.isOverdue).reduce((sum, i) => sum + i.remainingAmount, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {students && students.length > 1 && (
        <div className="mb-4 rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
          <label className="mb-2 block text-xs font-medium text-espresso dark:text-cream">Öğrenci Seç</label>
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} ({s.branchName})
              </option>
            ))}
          </select>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Wallet className="h-4 w-4" />
            </div>
            <p className="text-xl font-bold text-espresso dark:text-cream">{formatTRY(totalRemaining)}</p>
            <p className="text-xs text-espresso-muted dark:text-cream/40">Kalan Toplam Borç</p>
          </div>
          <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <p className="text-xl font-bold text-espresso dark:text-cream">{formatTRY(overdueRemaining)}</p>
            <p className="text-xs text-espresso-muted dark:text-cream/40">Vadesi Geçmiş</p>
          </div>
        </div>

        <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
          <h3 className="mb-3 text-sm font-semibold text-espresso dark:text-cream">Taksit Planı</h3>
          {!installments ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
          ) : installments.length === 0 ? (
            <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">Henüz bir taksit planı tanımlanmamış.</p>
          ) : (
            <div className="space-y-2">
              {installments.map((inst) => {
                const meta = STATUS_META[inst.status];
                return (
                  <div
                    key={inst.id}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border p-3",
                      inst.isOverdue ? "border-rose-400/30 bg-rose-500/5" : "border-hairline dark:border-white/5"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-espresso dark:text-cream">{inst.title}</p>
                      <p className="text-xs text-espresso-muted dark:text-cream/40">
                        Vade: {new Date(inst.dueDate).toLocaleDateString("tr-TR")} · {formatTRY(inst.amount)}
                      </p>
                    </div>
                    <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold", meta.className)}>
                      <meta.icon className="h-3 w-3" /> {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <HandCoins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Ödeme Geçmişi
          </h3>
          {!payments ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
          ) : payments.length === 0 ? (
            <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">Henüz bir ödeme kaydı yok.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-hairline px-3 py-2 dark:border-white/5">
                  <p className="truncate text-xs text-espresso-muted dark:text-cream/40">
                    {new Date(p.paidAt).toLocaleDateString("tr-TR")} · {METHOD_LABEL[p.method] ?? p.method}
                  </p>
                  <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{formatTRY(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
