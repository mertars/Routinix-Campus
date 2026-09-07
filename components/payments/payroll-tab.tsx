"use client";

import { useEffect, useState } from "react";
import { Loader2, Users, Wallet, Plus, CheckCircle2, Clock, Calculator, HandCoins, ChevronDown, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import type { AccountRow } from "@/components/payments/payments-principal-panel";

type StaffRow = {
  key: string;
  teacherId: string | null;
  adminId: string | null;
  name: string;
  role: string;
  subtitle: string;
  weeklyHours: number;
  monthlyHours: number;
  payType: "MONTHLY_SALARY" | "HOURLY" | null;
  monthlyAmount: number | null;
  hourlyRate: number | null;
};
type PayrollItemRow = {
  id: string;
  staffName: string;
  staffRole: string;
  payType: "MONTHLY_SALARY" | "HOURLY";
  hours: number | null;
  rate: number | null;
  baseAmount: number;
  advanceDeduction: number;
  netAmount: number;
};
type PeriodRow = {
  id: string;
  year: number;
  month: number;
  status: "DRAFT" | "PAID";
  totalAmount: number;
  paidAt: string | null;
  itemCount: number;
  items: PayrollItemRow[];
};
type PreviewRow = Omit<PayrollItemRow, "id">;

const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

export function PayrollTab({ accounts, onChanged }: { accounts: AccountRow[]; onChanged: () => void }) {
  const { showError, showSuccess } = useToast();
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [periods, setPeriods] = useState<PeriodRow[] | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [salaryTarget, setSalaryTarget] = useState<StaffRow | null>(null);
  const [advanceTarget, setAdvanceTarget] = useState<StaffRow | null>(null);
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  function loadAll() {
    fetch("/api/payments/principal/salary-profiles")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => setStaff(d.staff ?? []))
      .catch(() => showError("Personel listesi yüklenemedi."));
    fetch("/api/payments/principal/payroll?preview=1")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => {
        setPeriods(d.periods ?? []);
        setPreview(d.preview ?? []);
        setPreviewTotal(d.previewTotal ?? 0);
      })
      .catch(() => showError("Bordro bilgileri yüklenemedi."));
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createPayroll() {
    setCreating(true);
    try {
      const now = new Date();
      const res = await fetch("/api/payments/principal/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: now.getFullYear(), month: now.getMonth() + 1 }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error);
      }
      showSuccess("Bordro oluşturuldu.");
      loadAll();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Bordro oluşturulamadı.");
    } finally {
      setCreating(false);
    }
  }

  async function payPeriod(periodId: string, accountId: string) {
    if (!accountId) return;
    setPayingId(periodId);
    try {
      const res = await fetch(`/api/payments/principal/payroll/${periodId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error);
      }
      showSuccess("Bordro ödendi ve gider kaydı oluşturuldu.");
      loadAll();
      onChanged();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Bordro ödenemedi.");
    } finally {
      setPayingId(null);
    }
  }

  const definedStaff = (staff ?? []).filter((s) => s.payType != null);
  const undefinedStaff = (staff ?? []).filter((s) => s.payType == null);

  return (
    <div className="space-y-4">
      {/* Bu ayın bordro önizlemesi */}
      <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <Calculator className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()} Bordro Önizlemesi
          </h3>
          <button
            onClick={createPayroll}
            disabled={creating || !preview || preview.length === 0}
            className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Bordro Oluştur
          </button>
        </div>

        {!preview ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          </div>
        ) : preview.length === 0 ? (
          <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">
            Ücret profili tanımlı personel yok. Aşağıdan personel ücretlerini tanımlayın.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              {preview.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-hairline px-3 py-2 dark:border-white/5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-espresso dark:text-cream">{p.staffName}</p>
                    <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">
                      {p.staffRole} ·{" "}
                      {p.payType === "HOURLY"
                        ? `${p.hours} saat × ${formatTRY(p.rate ?? 0)}`
                        : "Aylık maaş"}
                      {p.advanceDeduction > 0 ? ` · avans −${formatTRY(p.advanceDeduction)}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-espresso dark:text-cream">{formatTRY(p.netAmount)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 dark:border-white/5">
              <span className="text-xs font-medium text-espresso-muted dark:text-cream/40">Toplam</span>
              <span className="text-base font-bold text-espresso dark:text-cream">{formatTRY(previewTotal)}</span>
            </div>
          </>
        )}
      </div>

      {/* Geçmiş bordrolar */}
      {periods && periods.length > 0 && (
        <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
          <h3 className="mb-3 text-sm font-semibold text-espresso dark:text-cream">Bordro Dönemleri</h3>
          <div className="space-y-2">
            {periods.map((p) => {
              const isOpen = expandedPeriod === p.id;
              return (
                <div key={p.id} className="rounded-xl border border-hairline dark:border-white/5">
                  <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <button onClick={() => setExpandedPeriod(isOpen ? null : p.id)} className="flex min-w-0 items-center gap-2 text-left">
                      {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-espresso-muted" /> : <ChevronRight className="h-4 w-4 shrink-0 text-espresso-muted" />}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-espresso dark:text-cream">
                          {MONTH_NAMES[p.month - 1]} {p.year}
                        </span>
                        <span className="block truncate text-[10px] text-espresso-muted dark:text-cream/40">
                          {p.itemCount} personel · {formatTRY(p.totalAmount)}
                          {p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString("tr-TR")} ödendi` : ""}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                          p.status === "PAID" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        )}
                      >
                        {p.status === "PAID" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {p.status === "PAID" ? "Ödendi" : "Taslak"}
                      </span>
                      {p.status === "DRAFT" && (
                        <select
                          defaultValue=""
                          onChange={(e) => payPeriod(p.id, e.target.value)}
                          disabled={payingId === p.id || accounts.length === 0}
                          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 outline-none disabled:opacity-50 dark:text-emerald-300"
                        >
                          <option value="">Öde…</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="space-y-1 border-t border-hairline px-3 py-2 dark:border-white/5">
                      {p.items.map((i) => (
                        <div key={i.id} className="flex items-center justify-between gap-2 py-1">
                          <span className="min-w-0 truncate text-[11px] text-espresso dark:text-cream">
                            {i.staffName}
                            <span className="text-espresso-muted dark:text-cream/40">
                              {" · "}
                              {i.payType === "HOURLY" ? `${i.hours} saat` : "aylık"}
                              {i.advanceDeduction > 0 ? ` · avans −${formatTRY(i.advanceDeduction)}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11px] font-semibold text-espresso dark:text-cream">{formatTRY(i.netAmount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Personel ücret profilleri */}
      <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Personel Ücretleri
        </h3>
        <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">
          Saatlik çalışanların aylık ders saati haftalık ders programından otomatik hesaplanır.
        </p>

        {!staff ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="space-y-1.5">
            {[...definedStaff, ...undefinedStaff].map((s) => (
              <div key={s.key} className="flex flex-col gap-2 rounded-xl border border-hairline p-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-espresso dark:text-cream">{s.name}</p>
                  <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">
                    {s.role} · {s.subtitle}
                    {s.weeklyHours > 0 ? ` · haftalık ${s.weeklyHours} ders (~${s.monthlyHours} saat/ay)` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {s.payType ? (
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      {s.payType === "HOURLY" ? `${formatTRY(s.hourlyRate ?? 0)} / saat` : `${formatTRY(s.monthlyAmount ?? 0)} / ay`}
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-500/10 px-2.5 py-1 text-[10px] font-semibold text-gray-600 dark:text-gray-400">Tanımsız</span>
                  )}
                  <button
                    onClick={() => setSalaryTarget(s)}
                    className="rounded-full border border-hairline px-2.5 py-1 text-[11px] font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
                  >
                    {s.payType ? "Düzenle" : "Tanımla"}
                  </button>
                  <button
                    onClick={() => setAdvanceTarget(s)}
                    title="Avans ver"
                    className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-500/20 dark:text-amber-300"
                  >
                    <HandCoins className="h-3 w-3" /> Avans
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SalaryProfileModal staff={salaryTarget} onClose={() => setSalaryTarget(null)} onSaved={loadAll} />
      <AdvanceModal staff={advanceTarget} onClose={() => setAdvanceTarget(null)} onSaved={loadAll} />
    </div>
  );
}

function SalaryProfileModal({ staff, onClose, onSaved }: { staff: StaffRow | null; onClose: () => void; onSaved: () => void }) {
  const { showError, showSuccess } = useToast();
  const [payType, setPayType] = useState<"MONTHLY_SALARY" | "HOURLY">("MONTHLY_SALARY");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!staff) return;
    const initial = staff.payType ?? (staff.role === "Öğretmen" ? "HOURLY" : "MONTHLY_SALARY");
    setPayType(initial);
    setAmount(initial === "HOURLY" ? (staff.hourlyRate?.toString() ?? "") : (staff.monthlyAmount?.toString() ?? ""));
  }, [staff]);

  async function save() {
    if (!staff) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return showError("Geçerli bir tutar girin.");
    setSaving(true);
    try {
      const res = await fetch("/api/payments/principal/salary-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: staff.teacherId ?? undefined,
          adminId: staff.adminId ?? undefined,
          payType,
          monthlyAmount: payType === "MONTHLY_SALARY" ? value : undefined,
          hourlyRate: payType === "HOURLY" ? value : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error);
      }
      showSuccess("Ücret tanımı kaydedildi.");
      onSaved();
      onClose();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream";
  const isTeacher = staff?.role === "Öğretmen";
  const estimated = payType === "HOURLY" && staff ? staff.monthlyHours * (Number(amount) || 0) : null;

  return (
    <Modal isOpen={staff != null} onClose={onClose} title={staff ? `${staff.name} — Ücret Tanımı` : "Ücret Tanımı"} variant="center" widthClassName="max-w-sm">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setPayType("MONTHLY_SALARY")}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-xs font-medium transition",
              payType === "MONTHLY_SALARY" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/50"
            )}
          >
            Aylık Maaş
          </button>
          <button
            onClick={() => isTeacher && setPayType("HOURLY")}
            disabled={!isTeacher}
            title={isTeacher ? undefined : "Yönetici ders programında yer almadığı için saatlik ücret desteklenmiyor."}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-xs font-medium transition disabled:opacity-40",
              payType === "HOURLY" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/50"
            )}
          >
            Ders Saati Ücreti
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">
            {payType === "HOURLY" ? "Saat Ücreti (₺)" : "Aylık Ücret (₺)"}
          </label>
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          {payType === "HOURLY" && staff && (
            <p className="mt-1.5 text-[10px] text-espresso-muted dark:text-cream/40">
              Haftalık {staff.weeklyHours} ders → ~{staff.monthlyHours} saat/ay
              {estimated ? ` → tahmini ${formatTRY(estimated)}/ay` : ""}
            </p>
          )}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Kaydet
        </button>
      </div>
    </Modal>
  );
}

function AdvanceModal({ staff, onClose, onSaved }: { staff: StaffRow | null; onClose: () => void; onSaved: () => void }) {
  const { showError, showSuccess } = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (staff) {
      setAmount("");
      setNote("");
    }
  }, [staff]);

  async function save() {
    if (!staff) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return showError("Geçerli bir tutar girin.");
    setSaving(true);
    try {
      const res = await fetch("/api/payments/principal/staff-advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: staff.teacherId ?? undefined, adminId: staff.adminId ?? undefined, amount: value, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error);
      }
      showSuccess("Avans kaydedildi — bir sonraki bordroda mahsup edilecek.");
      onSaved();
      onClose();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Avans kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream";

  return (
    <Modal isOpen={staff != null} onClose={onClose} title={staff ? `${staff.name} — Avans` : "Avans"} variant="center" widthClassName="max-w-sm">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Tutar (₺)</label>
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Not (opsiyonel)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </div>
        <p className="rounded-xl border border-hairline px-3 py-2 text-[10px] text-espresso-muted dark:border-white/10 dark:text-cream/40">
          Avans, bir sonraki bordroda net ücretten otomatik düşülür. Maaşı aşan kısım sonraki döneme devreder.
        </p>
        <button
          onClick={save}
          disabled={saving}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-amber-600 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />} Avansı Kaydet
        </button>
      </div>
    </Modal>
  );
}
