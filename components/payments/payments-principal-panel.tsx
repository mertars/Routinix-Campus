"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Users, Landmark, Plus, AlertTriangle, TrendingUp, TrendingDown, Wallet, Loader2, HandCoins, Banknote, Receipt, Send, BarChart3, FileSignature, Users2, Package, Target, ArrowLeftRight, Handshake } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { canAccessTab, PAYMENT_ROLE_LABEL, type PaymentRole } from "@/lib/payments/payment-roles";
import { CashCountCard } from "@/components/payments/cash-count-card";
import { StaffRolesCard } from "@/components/payments/staff-roles-card";
import { ReminderRuleCard } from "@/components/payments/reminder-rule-card";
import { AccountModal } from "@/components/payments/account-modal";
import { StudentPaymentsTab } from "@/components/payments/student-payments-tab";
import { ExpensesTab } from "@/components/payments/expenses-tab";
import { ReminderModal } from "@/components/payments/reminder-modal";
import { PromisesCard } from "@/components/payments/promises-card";
import { ReportsTab } from "@/components/payments/reports-tab";
import { ContractsTab } from "@/components/payments/contracts-tab";
import { PayrollTab } from "@/components/payments/payroll-tab";
import { ProductsTab } from "@/components/payments/products-tab";
import { BudgetTab } from "@/components/payments/budget-tab";
import { TransferModal } from "@/components/payments/transfer-modal";

export type AccountRow = { id: string; name: string; type: "CASH" | "BANK"; balance: number };

type DashboardData = {
  accounts: AccountRow[];
  totalBalance: number;
  monthlyCollected: number;
  monthlyExpense: number;
  monthlyNet: number;
  expenseBreakdown: { name: string; amount: number }[];
  pendingExpenses: { id: string; title: string; categoryName: string; vendorName: string | null; amount: number; dueDate: string | null; isOverdue: boolean }[];
  pendingExpenseTotal: number;
  plannedTotal: number;
  collectedTotal: number;
  pendingTotal: number;
  overdueTotal: number;
  overdueInstallments: { id: string; studentId: string; studentName: string; title: string; remainingAmount: number; dueDate: string }[];
  recentPayments: { id: string; studentName: string; accountName: string; amount: number; method: string; paidAt: string }[];
};

const TABS = [
  { id: "dashboard", label: "Kontrol Paneli", icon: LayoutDashboard },
  { id: "students", label: "Öğrenci Ödemeleri", icon: Users },
  { id: "expenses", label: "Giderler", icon: Receipt },
  { id: "accounts", label: "Kasa & Banka", icon: Landmark },
  { id: "products", label: "Ürün & Etkinlik", icon: Package },
  { id: "payroll", label: "Bordro", icon: Users2 },
  { id: "contracts", label: "Sözleşmeler", icon: FileSignature },
  { id: "budget", label: "Bütçe", icon: Target },
  { id: "reports", label: "Raporlar", icon: BarChart3 },
] as const;
type TabId = (typeof TABS)[number]["id"];

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

const METHOD_LABEL: Record<string, string> = { CASH: "Nakit", BANK_TRANSFER: "Havale/EFT", CREDIT_CARD: "Kredi Kartı" };

export function PaymentsPrincipalPanel() {
  const { showError } = useToast();
  const [tab, setTab] = useState<TabId>("dashboard");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  // Söz kartını tazelemek için sayaç — gecikmiş listesinden söz alınınca
  // kart yeniden yüklensin.
  const [promiseKey, setPromiseKey] = useState(0);
  // null = yetki henüz bilinmiyor. Sekmeler yetki gelene kadar
  // GİZLENİR — önce hepsini gösterip sonra silmek, yetkisiz kullanıcıya
  // bir an için yapamayacağı işlemleri vaat ederdi.
  const [paymentRole, setPaymentRole] = useState<PaymentRole | null>(null);

  function loadDashboard() {
    fetch("/api/payments/principal/dashboard")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setDashboard(data))
      .catch(() => showError("Kontrol paneli yüklenemedi."));
  }

  useEffect(() => {
    fetch("/api/payments/principal/me")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((d) => setPaymentRole(d.paymentRole as PaymentRole))
      .catch(() => setPaymentRole("NONE"));
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleTabs = paymentRole ? TABS.filter((t) => canAccessTab(paymentRole, t.id)) : [];

  // Görünür olmayan bir sekmede kalınmasın (yetki işlem sırasında
  // kısıtlanmış olabilir).
  useEffect(() => {
    if (paymentRole && !canAccessTab(paymentRole, tab) && visibleTabs[0]) setTab(visibleTabs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentRole, tab]);

  if (paymentRole === "NONE") {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-sm font-semibold text-espresso dark:text-cream">Ödeme modülüne erişiminiz yok</p>
        <p className="mt-2 text-xs text-espresso-muted dark:text-cream/40">
          Yetki tanımlanması için kurumunuzdaki tam yetkili bir yöneticiye başvurun.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-10">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              tab === t.id
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
        {paymentRole === "COLLECTOR" && (
          <span className="ml-auto rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            {PAYMENT_ROLE_LABEL.COLLECTOR} yetkisi
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {tab === "dashboard" && (
          <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <DashboardTab
              data={dashboard}
              canManage={paymentRole === "FULL"}
              onRemindClick={() => setReminderOpen(true)}
              promiseKey={promiseKey}
              onPromiseChanged={() => setPromiseKey((k) => k + 1)}
            />
          </motion.div>
        )}
        {tab === "students" && (
          <motion.div key="students" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <StudentPaymentsTab accounts={dashboard?.accounts ?? []} onChanged={loadDashboard} canManage={paymentRole === "FULL"} />
          </motion.div>
        )}
        {tab === "expenses" && (
          <motion.div key="expenses" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ExpensesTab accounts={dashboard?.accounts ?? []} onChanged={loadDashboard} />
          </motion.div>
        )}
        {tab === "accounts" && (
          <motion.div key="accounts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="space-y-4">
              <AccountsTab
                accounts={dashboard?.accounts ?? null}
                onAddClick={() => setAccountModalOpen(true)}
                onTransferClick={() => setTransferOpen(true)}
              />
              {/* Kasa sayımı, otomatik hatırlatma ve yetkiler bu sekmede:
                  üçü de "kurulum/işletme" işleri, günlük tahsilat akışının
                  ortasında durmamalı. */}
              <CashCountCard />
              <ReminderRuleCard />
              <StaffRolesCard />
            </div>
          </motion.div>
        )}
        {tab === "products" && (
          <motion.div key="products" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ProductsTab onChanged={loadDashboard} />
          </motion.div>
        )}
        {tab === "payroll" && (
          <motion.div key="payroll" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <PayrollTab accounts={dashboard?.accounts ?? []} onChanged={loadDashboard} />
          </motion.div>
        )}
        {tab === "contracts" && (
          <motion.div key="contracts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ContractsTab />
          </motion.div>
        )}
        {tab === "budget" && (
          <motion.div key="budget" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <BudgetTab />
          </motion.div>
        )}
        {tab === "reports" && (
          <motion.div key="reports" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ReportsTab />
          </motion.div>
        )}
      </AnimatePresence>

      <AccountModal isOpen={accountModalOpen} onClose={() => setAccountModalOpen(false)} onCreated={loadDashboard} />
      <ReminderModal isOpen={reminderOpen} onClose={() => setReminderOpen(false)} onSent={loadDashboard} />
      <TransferModal isOpen={transferOpen} onClose={() => setTransferOpen(false)} accounts={dashboard?.accounts ?? []} onTransferred={loadDashboard} />
    </div>
  );
}

// alert=true: rakam KÖTÜ bir durumu anlatıyor (eksi bakiye, gecikmiş
// alacak). Ekrandaki en alarm verici sayının "her şey yolunda" rengiyle
// çizilmesi, panelin en kötü tasarım hatasıydı — eksi bakiye pozitiften
// ayırt edilemiyordu.
function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  alert,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: "emerald" | "amber" | "rose" | "sky";
  alert?: boolean;
}) {
  const toneClass = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  }[alert ? "rose" : tone];
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-4 dark:bg-midnight-card/50",
        alert ? "border-rose-400/40" : "border-hairline dark:border-white/5"
      )}
    >
      <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", toneClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className={cn("text-xl font-bold", alert ? "text-rose-600 dark:text-rose-400" : "text-espresso dark:text-cream")}>{value}</p>
      <p className="text-xs text-espresso-muted dark:text-cream/40">{label}</p>
    </div>
  );
}

async function createPromise(studentName: string, studentId: string, defaultAmount: number, onDone: () => void) {
  const dateInput = window.prompt(
    `${studentName} için ödeme sözü kaydedilecek.\n\nVeli ne zaman ödeyeceğini söyledi? (YYYY-AA-GG)`,
    new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  );
  if (!dateInput) return;
  const amountInput = window.prompt("Söz verilen tutar (₺):", String(Math.round(defaultAmount)));
  if (!amountInput) return;
  const note = window.prompt("Not (opsiyonel):") ?? "";
  const res = await fetch("/api/payments/principal/promises", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, promisedAmount: Number(amountInput), promisedDate: dateInput, note: note.trim() || undefined }),
  });
  if (res.ok) onDone();
}

function DashboardTab({
  data,
  canManage,
  onRemindClick,
  promiseKey,
  onPromiseChanged,
}: {
  data: DashboardData | null;
  canManage: boolean;
  onRemindClick: () => void;
  promiseKey: number;
  onPromiseChanged: () => void;
}) {
  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Wallet} label="Toplam Bakiye" value={formatTRY(data.totalBalance)} tone="emerald" alert={data.totalBalance < 0} />
        <StatCard icon={TrendingUp} label="Bu Ay Tahsilat" value={formatTRY(data.monthlyCollected)} tone="sky" />
        <StatCard icon={HandCoins} label="Bekleyen Toplam" value={formatTRY(data.pendingTotal)} tone="amber" />
        <StatCard icon={AlertTriangle} label="Gecikmiş Toplam" value={formatTRY(data.overdueTotal)} tone="rose" alert={data.overdueTotal > 0} />
      </div>

      {/* Tahsilat oranı — planlanan tüm taksitlerin ne kadarı tahsil edildi.
          Faz 1'de grafik kütüphanesi eklenmeden (bkz. plan) tek bakışta
          "yılın neresindeyiz" sorusuna cevap veren tek gösterge. */}
      <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm font-semibold text-espresso dark:text-cream">Tahsilat Durumu</h3>
          <p className="text-xs text-espresso-muted dark:text-cream/40">
            {formatTRY(data.collectedTotal)} / {formatTRY(data.plannedTotal)} planlanan
          </p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
            style={{ width: `${data.plannedTotal > 0 ? Math.min(100, (data.collectedTotal / data.plannedTotal) * 100) : 0}%` }}
          />
        </div>
        <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          %{data.plannedTotal > 0 ? Math.round((data.collectedTotal / data.plannedTotal) * 100) : 0} tahsil edildi
        </p>

        {data.accounts.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-hairline pt-3 dark:border-white/5 sm:grid-cols-3 lg:grid-cols-4">
            {data.accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl bg-cream-card px-3 py-2 dark:bg-white/[0.03]">
                {a.type === "CASH" ? (
                  <Banknote className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Landmark className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[10px] text-espresso-muted dark:text-cream/40">{a.name}</span>
                  <span className={cn("block text-xs font-semibold", a.balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-espresso dark:text-cream")}>
                    {formatTRY(a.balance)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bu ayın gelir/gider/net tablosu + gider kategori dağılımı (Faz 2).
          Grafik kütüphanesi yerine oransal Tailwind çubukları — dağılım tek
          bakışta okunuyor, yeni bağımlılık yok. */}
      <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
        <h3 className="mb-3 text-sm font-semibold text-espresso dark:text-cream">Bu Ay Gelir / Gider</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="flex items-center gap-1 text-[11px] text-espresso-muted dark:text-cream/40">
              <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Gelir
            </p>
            <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">{formatTRY(data.monthlyCollected)}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-[11px] text-espresso-muted dark:text-cream/40">
              <TrendingDown className="h-3 w-3 text-rose-600 dark:text-rose-400" /> Gider
            </p>
            <p className="text-base font-bold text-rose-700 dark:text-rose-300">{formatTRY(data.monthlyExpense)}</p>
          </div>
          <div>
            <p className="text-[11px] text-espresso-muted dark:text-cream/40">Net</p>
            <p className={cn("text-base font-bold", data.monthlyNet >= 0 ? "text-espresso dark:text-cream" : "text-rose-700 dark:text-rose-300")}>
              {formatTRY(data.monthlyNet)}
            </p>
          </div>
        </div>

        {/* Gelir/gider oranı — tek çubukta iki taraf */}
        {(data.monthlyCollected > 0 || data.monthlyExpense > 0) && (
          <div className="mt-3 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
            <div className="bg-emerald-500" style={{ width: `${(data.monthlyCollected / Math.max(1, data.monthlyCollected + data.monthlyExpense)) * 100}%` }} />
            <div className="bg-rose-500" style={{ width: `${(data.monthlyExpense / Math.max(1, data.monthlyCollected + data.monthlyExpense)) * 100}%` }} />
          </div>
        )}

        {data.expenseBreakdown.length > 0 && (
          <div className="mt-4 space-y-1.5 border-t border-hairline pt-3 dark:border-white/5">
            <p className="mb-2 text-[11px] font-semibold text-espresso-muted dark:text-cream/40">Gider Dağılımı (bu ay)</p>
            {data.expenseBreakdown.slice(0, 5).map((c) => (
              <div key={c.name} className="flex items-center gap-2">
                <span className="w-32 shrink-0 truncate text-[11px] text-espresso dark:text-cream">{c.name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
                  <span
                    className="block h-full rounded-full bg-rose-400"
                    style={{ width: `${(c.amount / Math.max(1, data.expenseBreakdown[0].amount)) * 100}%` }}
                  />
                </span>
                <span className="w-20 shrink-0 text-right text-[11px] font-semibold text-espresso dark:text-cream">{formatTRY(c.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <PromisesCard refreshKey={promiseKey} onChanged={onPromiseChanged} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
              <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" /> Gecikmiş Ödemeler
            </h3>
            {data.overdueInstallments.length > 0 && canManage && (
              <button
                onClick={onRemindClick}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
              >
                <Send className="h-3 w-3" /> Hatırlatma Gönder
              </button>
            )}
          </div>
          {data.overdueInstallments.length === 0 ? (
            <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">Gecikmiş ödeme yok 🎉</p>
          ) : (
            <div className="space-y-2">
              {data.overdueInstallments.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 rounded-xl border border-rose-400/20 bg-rose-500/5 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-espresso dark:text-cream">{o.studentName}</p>
                    <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">
                      {o.title} · vade {new Date(o.dueDate).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">{formatTRY(o.remainingAmount)}</span>
                    <button
                      onClick={() => createPromise(o.studentName, o.studentId, o.remainingAmount, onPromiseChanged)}
                      title="Veli ödeme sözü verdiyse kaydet"
                      className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-500/20 dark:text-amber-300"
                    >
                      <Handshake className="h-3 w-3" /> Söz Al
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <HandCoins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Son İşlemler
          </h3>
          {data.recentPayments.length === 0 ? (
            <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">Henüz tahsilat kaydı yok.</p>
          ) : (
            <div className="space-y-2">
              {data.recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-hairline px-3 py-2 dark:border-white/5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-espresso dark:text-cream">{p.studentName}</p>
                    <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">
                      {p.accountName} · {METHOD_LABEL[p.method] ?? p.method} · {new Date(p.paidAt).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{formatTRY(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountsTab({
  accounts,
  onAddClick,
  onTransferClick,
}: {
  accounts: AccountRow[] | null;
  onAddClick: () => void;
  onTransferClick: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-espresso dark:text-cream">Kasa & Banka Hesapları</h3>
        <div className="flex gap-2">
          <button
            onClick={onTransferClick}
            disabled={(accounts?.length ?? 0) < 2}
            title={(accounts?.length ?? 0) < 2 ? "Virman için en az iki hesap gerekir." : undefined}
            className="flex items-center gap-1.5 rounded-full border border-hairline px-3 py-2 text-xs font-semibold text-espresso transition hover:bg-cream-card disabled:opacity-40 dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" /> Virman
          </button>
          <button
            onClick={onAddClick}
            className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
          >
            <Plus className="h-3.5 w-3.5" /> Yeni Hesap Ekle
          </button>
        </div>
      </div>

      {!accounts ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center dark:border-white/20">
          <Wallet className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-espresso-muted dark:text-cream/60">Henüz bir kasa/banka hesabı yok. Tahsilat kaydedebilmek için önce bir hesap ekleyin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <div
              key={a.id}
              className={cn(
                "rounded-2xl border bg-white p-4 dark:bg-midnight-card/50",
                a.balance < 0 ? "border-rose-400/40" : "border-hairline dark:border-white/5"
              )}
            >
              <div
                className={cn(
                  "mb-3 flex h-9 w-9 items-center justify-center rounded-lg",
                  a.balance < 0
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                )}
              >
                {a.type === "CASH" ? <Banknote className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
              </div>
              <p className="text-sm font-semibold text-espresso dark:text-cream">{a.name}</p>
              <p className={cn("mt-1 text-lg font-bold", a.balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-300")}>
                {formatTRY(a.balance)}
              </p>
              {a.balance < 0 && (
                <p className="mt-1 text-[10px] font-medium text-rose-600 dark:text-rose-400">Hesap eksi bakiyede</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
