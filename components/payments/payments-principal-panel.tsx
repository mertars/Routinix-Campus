"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Users, Landmark, Plus, AlertTriangle, TrendingUp, Wallet, Loader2, HandCoins, Banknote } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { AccountModal } from "@/components/payments/account-modal";
import { StudentPaymentsTab } from "@/components/payments/student-payments-tab";

export type AccountRow = { id: string; name: string; type: "CASH" | "BANK"; balance: number };

type DashboardData = {
  accounts: AccountRow[];
  totalBalance: number;
  monthlyCollected: number;
  plannedTotal: number;
  collectedTotal: number;
  pendingTotal: number;
  overdueTotal: number;
  overdueInstallments: { id: string; studentName: string; title: string; remainingAmount: number; dueDate: string }[];
  recentPayments: { id: string; studentName: string; accountName: string; amount: number; method: string; paidAt: string }[];
};

const TABS = [
  { id: "dashboard", label: "Kontrol Paneli", icon: LayoutDashboard },
  { id: "students", label: "Öğrenci Ödemeleri", icon: Users },
  { id: "accounts", label: "Kasa & Banka", icon: Landmark },
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

  function loadDashboard() {
    fetch("/api/payments/principal/dashboard")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setDashboard(data))
      .catch(() => showError("Kontrol paneli yüklenemedi."));
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-10">
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
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
      </div>

      <AnimatePresence mode="wait">
        {tab === "dashboard" && (
          <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <DashboardTab data={dashboard} />
          </motion.div>
        )}
        {tab === "students" && (
          <motion.div key="students" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <StudentPaymentsTab accounts={dashboard?.accounts ?? []} onChanged={loadDashboard} />
          </motion.div>
        )}
        {tab === "accounts" && (
          <motion.div key="accounts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AccountsTab accounts={dashboard?.accounts ?? null} onAddClick={() => setAccountModalOpen(true)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AccountModal isOpen={accountModalOpen} onClose={() => setAccountModalOpen(false)} onCreated={loadDashboard} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Wallet; label: string; value: string; tone: "emerald" | "amber" | "rose" | "sky" }) {
  const toneClass = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  }[tone];
  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
      <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", toneClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xl font-bold text-espresso dark:text-cream">{value}</p>
      <p className="text-xs text-espresso-muted dark:text-cream/40">{label}</p>
    </div>
  );
}

function DashboardTab({ data }: { data: DashboardData | null }) {
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
        <StatCard icon={Wallet} label="Toplam Bakiye" value={formatTRY(data.totalBalance)} tone="emerald" />
        <StatCard icon={TrendingUp} label="Bu Ay Tahsilat" value={formatTRY(data.monthlyCollected)} tone="sky" />
        <StatCard icon={HandCoins} label="Bekleyen Toplam" value={formatTRY(data.pendingTotal)} tone="amber" />
        <StatCard icon={AlertTriangle} label="Gecikmiş Toplam" value={formatTRY(data.overdueTotal)} tone="rose" />
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
                  <span className="block text-xs font-semibold text-espresso dark:text-cream">{formatTRY(a.balance)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" /> Gecikmiş Ödemeler
          </h3>
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
                  <span className="shrink-0 text-xs font-semibold text-rose-700 dark:text-rose-300">{formatTRY(o.remainingAmount)}</span>
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

function AccountsTab({ accounts, onAddClick }: { accounts: AccountRow[] | null; onAddClick: () => void }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-espresso dark:text-cream">Kasa & Banka Hesapları</h3>
        <button
          onClick={onAddClick}
          className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
        >
          <Plus className="h-3.5 w-3.5" /> Yeni Hesap Ekle
        </button>
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
            <div key={a.id} className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                {a.type === "CASH" ? <Banknote className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}
              </div>
              <p className="text-sm font-semibold text-espresso dark:text-cream">{a.name}</p>
              <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatTRY(a.balance)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
