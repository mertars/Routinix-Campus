"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, CalendarPlus, HandCoins, Loader2, CheckCircle2, Clock, AlertTriangle, XCircle, BadgePercent, Receipt, FileDown, Ban, CalendarClock, Layers, UserMinus } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { InstallmentPlanModal } from "@/components/payments/installment-plan-modal";
import { CollectPaymentModal } from "@/components/payments/collect-payment-modal";
import { DiscountModal } from "@/components/payments/discount-modal";
import { RestructureModal } from "@/components/payments/restructure-modal";
import { CancellationModal } from "@/components/payments/cancellation-modal";
import type { AccountRow } from "@/components/payments/payments-principal-panel";

type RosterStudent = { id: string; firstName: string; lastName: string; branchName: string; grade: number };
type PaymentHistoryRow = {
  id: string;
  amount: number;
  method: string;
  status: string;
  receiptNo: number | null;
  title: string;
  accountName: string;
  collectedBy: string;
  paidAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  voidedBy: string | null;
};

type InstallmentRow = {
  id: string;
  title: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: "PENDING" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  isOverdue: boolean;
};

const METHOD_LABEL: Record<string, string> = { CASH: "Nakit", BANK_TRANSFER: "Havale/EFT", CREDIT_CARD: "Kredi Kartı" };

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

const STATUS_META: Record<InstallmentRow["status"], { label: string; className: string; icon: typeof Clock }> = {
  PENDING: { label: "Bekliyor", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300", icon: Clock },
  PARTIALLY_PAID: { label: "Kısmi Ödendi", className: "bg-sky-500/10 text-sky-700 dark:text-sky-300", icon: Clock },
  PAID: { label: "Ödendi", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 },
  CANCELLED: { label: "İptal", className: "bg-gray-500/10 text-gray-600 dark:text-gray-400", icon: XCircle },
};

export function StudentPaymentsTab({ accounts, onChanged }: { accounts: AccountRow[]; onChanged: () => void }) {
  const { showError, showSuccess } = useToast();
  const [roster, setRoster] = useState<RosterStudent[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<RosterStudent | null>(null);
  const [installments, setInstallments] = useState<InstallmentRow[] | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [collectTarget, setCollectTarget] = useState<InstallmentRow | null>(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [history, setHistory] = useState<PaymentHistoryRow[] | null>(null);
  const [restructureOpen, setRestructureOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    fetch("/api/payments/principal/students")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setRoster(data.students ?? []))
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadInstallments(studentId: string) {
    fetch(`/api/payments/principal/installments?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setInstallments(data.installments ?? []))
      .catch(() => showError("Taksit planı yüklenemedi."));
    fetch(`/api/payments/principal/payments?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setHistory(data.payments ?? []))
      .catch(() => setHistory([]));
  }

  function selectStudent(s: RosterStudent) {
    setSelectedStudent(s);
    setInstallments(null);
    setHistory(null);
    loadInstallments(s.id);
  }

  async function postpone(inst: InstallmentRow) {
    const current = new Date(inst.dueDate);
    const suggested = new Date(current);
    suggested.setMonth(suggested.getMonth() + 1);
    const input = window.prompt(
      `"${inst.title}" taksitinin vadesi ötelenecek.\n\nMevcut vade: ${current.toLocaleDateString("tr-TR")}\nTutar değişmez, borç silinmez — yalnızca vade ileri alınır.\n\nYeni vade (YYYY-AA-GG):`,
      suggested.toISOString().slice(0, 10)
    );
    if (!input) return;
    const reason = window.prompt("Erteleme gerekçesi:");
    if (!reason?.trim()) return;
    try {
      const res = await fetch(`/api/payments/principal/installments/${inst.id}/postpone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newDueDate: input, reason: reason.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error);
      }
      showSuccess("Taksit ertelendi.");
      refresh();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Taksit ertelenemedi.");
    }
  }

  async function voidPayment(p: PaymentHistoryRow) {
    const reason = window.prompt(
      `${formatTRY(p.amount)} tutarındaki tahsilat iptal edilecek.\n\nKayıt silinmez; bakiye ve raporlardan düşer, denetim izi kalır.\n\nİptal gerekçesi:`
    );
    if (!reason?.trim()) return;
    try {
      const res = await fetch(`/api/payments/principal/payments/${p.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error);
      }
      showSuccess("Tahsilat iptal edildi. Taksit durumu güncellendi.");
      refresh();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Tahsilat iptal edilemedi.");
    }
  }

  function refresh() {
    if (selectedStudent) loadInstallments(selectedStudent.id);
    onChanged();
  }

  const filtered = useMemo(() => {
    if (!roster) return [];
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return roster;
    return roster.filter((s) => `${s.firstName} ${s.lastName}`.toLocaleLowerCase("tr-TR").includes(q) || s.branchName.toLocaleLowerCase("tr-TR").includes(q));
  }, [roster, query]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* Öğrenci arama/seçim listesi */}
      <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Öğrenci ara..."
            className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>
        {!roster ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => selectStudent(s)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition",
                  selectedStudent?.id === s.id ? "bg-emerald-500/10" : "hover:bg-cream-card dark:hover:bg-white/5"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-espresso dark:text-cream">
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="block truncate text-[10px] text-espresso-muted dark:text-cream/40">
                    {s.branchName} · {s.grade}. Sınıf
                  </span>
                </span>
              </button>
            ))}
            {filtered.length === 0 && <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">Öğrenci bulunamadı.</p>}
          </div>
        )}
      </div>

      {/* Seçili öğrencinin taksit planı */}
      <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
        {!selectedStudent ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center">
            <HandCoins className="h-10 w-10 text-espresso-muted/40 dark:text-cream/20" />
            <p className="text-sm text-espresso-muted dark:text-cream/40">Taksit planını görmek için soldan bir öğrenci seçin.</p>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-espresso dark:text-cream">
                  {selectedStudent.firstName} {selectedStudent.lastName}
                </p>
                <p className="text-xs text-espresso-muted dark:text-cream/40">
                  {selectedStudent.branchName} · {selectedStudent.grade}. Sınıf
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setDiscountOpen(true)}
                  className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                >
                  <BadgePercent className="h-3.5 w-3.5" /> İndirim
                </button>
                <button
                  onClick={() => setCancelOpen(true)}
                  title="Öğrenci ayrıldı — kalan taksitleri iptal et ve iade hesapla"
                  className="flex items-center gap-1.5 rounded-full border border-rose-400/25 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10 dark:border-rose-400/20 dark:text-rose-400"
                >
                  <UserMinus className="h-3.5 w-3.5" /> Kayıt İptali
                </button>
                <button
                  onClick={() => setRestructureOpen(true)}
                  className="flex items-center gap-1.5 rounded-full border border-hairline px-3 py-2 text-xs font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
                >
                  <Layers className="h-3.5 w-3.5" /> Yapılandır
                </button>
                <button
                  onClick={() => setPlanModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
                >
                  <CalendarPlus className="h-3.5 w-3.5" /> Taksit Planı Oluştur
                </button>
              </div>
            </div>

            {!installments ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              </div>
            ) : installments.length === 0 ? (
              <p className="py-8 text-center text-sm text-espresso-muted dark:text-cream/40">Bu öğrenci için henüz bir taksit planı yok.</p>
            ) : (
              <div className="space-y-2">
                {installments.map((inst) => {
                  const meta = STATUS_META[inst.status];
                  const canCollect = inst.status === "PENDING" || inst.status === "PARTIALLY_PAID";
                  return (
                    <div
                      key={inst.id}
                      className={cn(
                        "flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                        inst.isOverdue ? "border-rose-400/30 bg-rose-500/5" : "border-hairline dark:border-white/5"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-espresso dark:text-cream">
                          {inst.title}
                          {inst.isOverdue && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />}
                        </p>
                        <p className="text-xs text-espresso-muted dark:text-cream/40">
                          Vade: {new Date(inst.dueDate).toLocaleDateString("tr-TR")} · {formatTRY(inst.amount)}
                          {inst.paidAmount > 0 && inst.status !== "PAID" ? ` (${formatTRY(inst.paidAmount)} ödendi)` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold", meta.className)}>
                          <meta.icon className="h-3 w-3" /> {meta.label}
                        </span>
                        {canCollect && (
                          <button
                            onClick={() => postpone(inst)}
                            title="Vadeyi ertele"
                            className="flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
                          >
                            <CalendarClock className="h-3 w-3" /> Ertele
                          </button>
                        )}
                        {canCollect && (
                          <button
                            onClick={() => setCollectTarget(inst)}
                            className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                          >
                            <HandCoins className="h-3 w-3" /> Tahsilat Kaydet
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <InstallmentPlanModal
        isOpen={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        studentId={selectedStudent?.id ?? null}
        studentName={selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : ""}
        onCreated={refresh}
      />
      {selectedStudent && history && history.length > 0 && (
        <div className="rounded-2xl border border-hairline bg-white p-4 lg:col-start-2 dark:border-white/5 dark:bg-midnight-card/50">
          <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Ödeme Geçmişi
          </h4>
          <div className="space-y-1.5">
            {history.map((p) => {
              const isVoided = p.status === "VOIDED";
              return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
                  isVoided ? "border-rose-400/25 bg-rose-500/5" : "border-hairline dark:border-white/5"
                )}
              >
                <div className="min-w-0">
                  <p className={cn("truncate text-xs font-medium text-espresso dark:text-cream", isVoided && "line-through opacity-60")}>
                    {formatTRY(p.amount)} · {METHOD_LABEL[p.method] ?? p.method}
                  </p>
                  <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">
                    {new Date(p.paidAt).toLocaleDateString("tr-TR")} · {p.title} · {p.collectedBy}
                    {p.receiptNo ? ` · Makbuz ${p.receiptNo}` : ""}
                  </p>
                  {isVoided && (
                    <p className="truncate text-[10px] font-medium text-rose-700 dark:text-rose-300">
                      İptal edildi{p.voidedBy ? ` · ${p.voidedBy}` : ""}
                      {p.voidReason ? ` · ${p.voidReason}` : ""}
                    </p>
                  )}
                </div>
                {isVoided ? (
                  <span className="shrink-0 rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-700 dark:text-rose-300">İptal</span>
                ) : (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <a
                      href={`/api/payments/principal/payments/${p.id}/receipt`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
                    >
                      <FileDown className="h-3 w-3" /> Makbuz
                    </a>
                    <button
                      onClick={() => voidPayment(p)}
                      title="Hatalı kaydı iptal et"
                      className="flex items-center gap-1 rounded-full border border-rose-400/25 px-2.5 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-500/10 dark:border-rose-400/20 dark:text-rose-400"
                    >
                      <Ban className="h-3 w-3" /> İptal
                    </button>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}

      <CancellationModal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        studentId={selectedStudent?.id ?? null}
        accounts={accounts}
        onDone={refresh}
      />
      <RestructureModal
        isOpen={restructureOpen}
        onClose={() => setRestructureOpen(false)}
        studentId={selectedStudent?.id ?? null}
        studentName={selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : ""}
        onDone={refresh}
      />
      <DiscountModal
        isOpen={discountOpen}
        onClose={() => setDiscountOpen(false)}
        studentId={selectedStudent?.id ?? null}
        studentName={selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : ""}
        academicYear="2025-2026"
        onChanged={refresh}
      />
      <CollectPaymentModal
        isOpen={collectTarget != null}
        onClose={() => setCollectTarget(null)}
        installmentId={collectTarget?.id ?? null}
        installmentTitle={collectTarget?.title ?? ""}
        remainingAmount={collectTarget?.remainingAmount ?? 0}
        accounts={accounts}
        onCollected={refresh}
      />
    </div>
  );
}
