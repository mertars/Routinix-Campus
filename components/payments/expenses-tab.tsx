"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Loader2, CheckCircle2, Clock, AlertTriangle, Receipt, Paperclip, X } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { RecurringExpensesCard } from "@/components/payments/recurring-expenses-card";
import { ExpenseModal, type ExpenseCategory } from "@/components/payments/expense-modal";
import type { AccountRow } from "@/components/payments/payments-principal-panel";

type ExpenseRow = {
  id: string;
  title: string;
  vendorName: string | null;
  categoryName: string;
  accountName: string | null;
  amount: number;
  status: "PENDING" | "PAID";
  dueDate: string | null;
  paidAt: string | null;
  isOverdue: boolean;
  attachmentUrl: string | null;
  attachmentName: string | null;
};

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

export function ExpensesTab({ accounts, onChanged }: { accounts: AccountRow[]; onChanged: () => void }) {
  const { showError, showSuccess } = useToast();
  const [expenses, setExpenses] = useState<ExpenseRow[] | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  function loadExpenses() {
    return fetch("/api/payments/principal/expenses")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setExpenses(data.expenses ?? []))
      .catch(() => showError("Gider listesi yüklenemedi."));
  }

  useEffect(() => {
    loadExpenses();
    fetch("/api/payments/principal/expense-categories")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => showError("Gider kategorileri yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    loadExpenses();
    onChanged();
  }

  // Bekleyen bir gideri öde — hangi hesaptan çıkacağı için ayrı bir modal
  // AÇMAK yerine, hesap seçimi satır içi bir <select> ile alınıp tek tıkla
  // ödeniyor (gider ödemesi tahsilata göre daha basit: tutar zaten sabit).
  async function payExpense(expenseId: string, accountId: string) {
    setPayingId(expenseId);
    try {
      const res = await fetch(`/api/payments/principal/expenses/${encodeURIComponent(expenseId)}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error);
      }
      showSuccess("Gider ödendi olarak işaretlendi.");
      refresh();
    } catch (err) {
      showError(err instanceof Error && err.message ? err.message : "Gider ödenemedi.");
    } finally {
      setPayingId(null);
    }
  }

  const pending = (expenses ?? []).filter((e) => e.status === "PENDING");
  const paid = (expenses ?? []).filter((e) => e.status === "PAID");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-espresso dark:text-cream">Giderler</h3>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-500"
        >
          <Plus className="h-3.5 w-3.5" /> Yeni Gider
        </button>
      </div>

      {!expenses ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-rose-600" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center dark:border-white/20">
          <Receipt className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-espresso-muted dark:text-cream/60">Henüz gider kaydı yok.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {pending.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Clock className="h-3.5 w-3.5" /> Bekleyen ({pending.length}) · {formatTRY(pending.reduce((s, e) => s + e.amount, 0))}
              </p>
              <div className="space-y-2">
                {pending.map((e) => (
                  <div
                    key={e.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                      e.isOverdue ? "border-rose-400/30 bg-rose-500/5" : "border-hairline dark:border-white/5"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-espresso dark:text-cream">
                        {e.title}
                        {e.isOverdue && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />}
                      </p>
                      <p className="truncate text-xs text-espresso-muted dark:text-cream/40">
                        {e.categoryName}
                        {e.vendorName ? ` · ${e.vendorName}` : ""}
                        {e.dueDate ? ` · son ödeme ${new Date(e.dueDate).toLocaleDateString("tr-TR")}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <AttachmentButton expense={e} onChanged={refresh} />
                      <span className="text-sm font-semibold text-espresso dark:text-cream">{formatTRY(e.amount)}</span>
                      <select
                        defaultValue={accounts[0]?.id ?? ""}
                        onChange={(ev) => payExpense(e.id, ev.target.value)}
                        disabled={payingId === e.id || accounts.length === 0}
                        className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-700 outline-none disabled:opacity-50 dark:text-rose-300"
                      >
                        <option value="">Öde…</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {paid.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> Ödenen ({paid.length}) · {formatTRY(paid.reduce((s, e) => s + e.amount, 0))}
              </p>
              <div className="space-y-2">
                {paid.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl border border-hairline p-3 dark:border-white/5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-espresso dark:text-cream">{e.title}</p>
                      <p className="truncate text-xs text-espresso-muted dark:text-cream/40">
                        {e.categoryName}
                        {e.accountName ? ` · ${e.accountName}` : ""}
                        {e.paidAt ? ` · ${new Date(e.paidAt).toLocaleDateString("tr-TR")}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <AttachmentButton expense={e} onChanged={refresh} />
                      <span className="text-sm font-semibold text-rose-700 dark:text-rose-300">−{formatTRY(e.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Şablonlar listenin ALTINDA: günlük iş gider girmek, şablon
          yönetimi ayda bir yapılan bir kurulum işi. */}
      <RecurringExpensesCard categories={categories} onGenerated={refresh} />

      <ExpenseModal isOpen={modalOpen} onClose={() => setModalOpen(false)} categories={categories} accounts={accounts} onCreated={refresh} />
    </div>
  );
}

// Fiş/fatura eki düğmesi.
//
// Bir gider kaydının arkasında belge olmadan, yıl sonunda mali müşavir
// "bu 85.000 neydi?" dediğinde elde yalnızca bir satır kalıyordu.
// Yükleme gizli bir <input type="file"> üzerinden — ayrı bir modal, tek
// dosyalık bir iş için fazla ağır olurdu.
function AttachmentButton({ expense, onChanged }: { expense: ExpenseRow; onChanged: () => void }) {
  const { showError, showSuccess } = useToast();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/payments/principal/expenses/${expense.id}/attachment`, { method: "POST", body });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error);
      showSuccess("Fiş eklendi.");
      onChanged();
    } catch (err) {
      showError(err instanceof Error && err.message ? err.message : "Fiş yüklenemedi.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!window.confirm("Bu giderin fişi kaldırılacak. Onaylıyor musunuz?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/payments/principal/expenses/${expense.id}/attachment`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showSuccess("Fiş kaldırıldı.");
      onChanged();
    } catch {
      showError("Fiş kaldırılamadı.");
    } finally {
      setBusy(false);
    }
  }

  if (expense.attachmentUrl) {
    return (
      <span className="flex items-center gap-1">
        <a
          href={expense.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={expense.attachmentName ?? "Fişi görüntüle"}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
        >
          <Paperclip className="h-3.5 w-3.5" />
        </a>
        <button
          onClick={remove}
          disabled={busy}
          title="Fişi kaldır"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-hairline text-espresso-muted transition hover:text-rose-600 disabled:opacity-50 dark:border-white/10 dark:text-cream/40"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Fiş/fatura ekle"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-hairline text-espresso-muted transition hover:bg-cream-card hover:text-espresso disabled:opacity-50 dark:border-white/10 dark:text-cream/40 dark:hover:bg-white/5"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
      </button>
    </>
  );
}
