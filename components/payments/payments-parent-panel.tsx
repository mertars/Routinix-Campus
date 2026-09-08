"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, Clock, AlertTriangle, XCircle, HandCoins, Wallet, Download, FileText, FileDown, CalendarClock, ExternalLink } from "lucide-react";
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
type PaymentRow = { id: string; amount: number; method: string; accountName: string; installmentTitle: string | null; paidAt: string };
type ContractRow = { id: string; title: string; status: string; signedAt: string | null; isExpired: boolean; shareToken: string };
type Summary = { planTotal: number; totalPaid: number; remaining: number };
type NextInstallment = { id: string; title: string; remainingAmount: number; dueDate: string; daysLeft: number };
type ParentPayload = {
  summary: Summary;
  nextInstallment: NextInstallment | null;
  installments: InstallmentRow[];
  payments: PaymentRow[];
  contracts: ContractRow[];
};

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

// "3 gün sonra" / "bugün" / "5 gün gecikti" — velinin tek bakışta anlaması
// gereken bilgi bu, ham tarih değil.
function dueLabel(daysLeft: number) {
  if (daysLeft < 0) return { text: `${Math.abs(daysLeft)} gün gecikti`, urgent: true };
  if (daysLeft === 0) return { text: "Bugün son gün", urgent: true };
  if (daysLeft === 1) return { text: "Yarın", urgent: true };
  return { text: `${daysLeft} gün sonra`, urgent: daysLeft <= 7 };
}

// Veli görünümü — SALT OKUNUR (ödeme alma akışı gerçek gateway ile
// gelecek). Veli burada borcunu, sıradaki taksitini, geçmiş ödemelerinin
// MAKBUZLARINI ve imzaladığı sözleşmeyi görür.
export function PaymentsParentPanel() {
  const { showError } = useToast();
  const [students, setStudents] = useState<ParentStudent[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<ParentPayload | null>(null);

  useEffect(() => {
    fetch("/api/parent/me")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((payload) => {
        const list: ParentStudent[] = payload.students ?? [];
        setStudents(list);
        if (list[0]) setSelectedId(list[0].id);
      })
      .catch(() => showError("Öğrenci bilgileri yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setData(null);
    fetch(`/api/payments/parent?studentId=${encodeURIComponent(selectedId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((payload: ParentPayload) => setData(payload))
      .catch(() => showError("Ödeme bilgileri yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const installments = data?.installments ?? null;
  const payments = data?.payments ?? null;
  const overdueRemaining = (installments ?? []).filter((i) => i.isOverdue).reduce((sum, i) => sum + i.remainingAmount, 0);
  const summary = data?.summary;
  const paidRatio = summary && summary.planTotal > 0 ? Math.min(100, (summary.totalPaid / summary.planTotal) * 100) : 0;
  const next = data?.nextInstallment ?? null;
  const due = next ? dueLabel(next.daysLeft) : null;

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
        {/* Sıradaki ödeme — velinin sayfaya girme sebebi genelde bu tek soru:
            "ne zaman, ne kadar ödeyeceğim?" */}
        {next && due && (
          <div
            className={cn(
              "rounded-2xl border p-4",
              due.urgent ? "border-rose-400/30 bg-rose-500/5" : "border-emerald-400/30 bg-emerald-500/5"
            )}
          >
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/50">
              <CalendarClock className="h-3.5 w-3.5" /> Sıradaki Ödemeniz
            </p>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-2xl font-bold text-espresso dark:text-cream">{formatTRY(next.remainingAmount)}</p>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  due.urgent ? "bg-rose-500/15 text-rose-700 dark:text-rose-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                )}
              >
                {due.text}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-espresso-muted dark:text-cream/40">
              {next.title} · Vade: {new Date(next.dueDate).toLocaleDateString("tr-TR")}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Wallet className="h-4 w-4" />
            </div>
            <p className="text-xl font-bold text-espresso dark:text-cream">{formatTRY(summary?.remaining ?? 0)}</p>
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

        {/* Ödeme ilerlemesi — "ne kadarını bitirdim?" sorusunun cevabı */}
        {summary && summary.planTotal > 0 && (
          <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-espresso dark:text-cream">Ödeme İlerlemesi</h3>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">%{Math.round(paidRatio)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-espresso/10 dark:bg-white/10">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${paidRatio}%` }} />
            </div>
            <p className="mt-2 text-xs text-espresso-muted dark:text-cream/40">
              {formatTRY(summary.totalPaid)} ödendi · toplam {formatTRY(summary.planTotal)}
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-espresso dark:text-cream">Taksit Planı</h3>
            {selectedId && (
              <a
                href={`/api/payments/parent/statement/${selectedId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1.5 text-[11px] font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
              >
                <FileDown className="h-3.5 w-3.5" /> Ekstre (PDF)
              </a>
            )}
          </div>
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
                        {inst.status === "PARTIALLY_PAID" && ` · ${formatTRY(inst.remainingAmount)} kaldı`}
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
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <HandCoins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Ödeme Geçmişi
          </h3>
          <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">Her ödemenin makbuzunu indirebilirsiniz.</p>
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
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-espresso dark:text-cream">{p.installmentTitle ?? "Serbest tahsilat"}</p>
                    <p className="truncate text-[11px] text-espresso-muted dark:text-cream/40">
                      {new Date(p.paidAt).toLocaleDateString("tr-TR")} · {METHOD_LABEL[p.method] ?? p.method}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{formatTRY(p.amount)}</span>
                    <a
                      href={`/api/payments/parent/receipt/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Makbuzu indir"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-espresso-muted transition hover:border-emerald-500/40 hover:text-emerald-600 dark:border-white/10 dark:text-cream/50 dark:hover:text-emerald-400"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sözleşmeler — veli SMS'teki bağlantıyı kaybetse de imzaladığı
            metne buradan kalıcı olarak ulaşabilir. */}
        {data && data.contracts.length > 0 && (
          <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
              <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Sözleşmeler
            </h3>
            <div className="space-y-2">
              {data.contracts.map((c) => {
                const signed = c.status === "SIGNED";
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-hairline px-3 py-2 dark:border-white/5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-espresso dark:text-cream">{c.title}</p>
                      <p className="text-[11px] text-espresso-muted dark:text-cream/40">
                        {signed && c.signedAt
                          ? `${new Date(c.signedAt).toLocaleDateString("tr-TR")} tarihinde imzalandı`
                          : c.isExpired
                            ? "Süresi doldu — kurumla iletişime geçin"
                            : "İmza bekliyor"}
                      </p>
                    </div>
                    {c.isExpired ? (
                      <span className="shrink-0 rounded-full bg-gray-500/10 px-2.5 py-1 text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                        Süresi Doldu
                      </span>
                    ) : (
                      <a
                        href={`/sozlesme/${c.shareToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition",
                          signed
                            ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                            : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
                        )}
                      >
                        {signed ? "Görüntüle" : "İmzala"} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
