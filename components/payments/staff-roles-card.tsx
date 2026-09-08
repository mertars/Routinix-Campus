"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldHalf } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { PAYMENT_ROLE_LABEL, PAYMENT_ROLE_DESCRIPTION, type PaymentRole } from "@/lib/payments/payment-roles";

type StaffRow = { id: string; name: string; title: string; paymentRole: PaymentRole; isSelf: boolean };

const ROLES: PaymentRole[] = ["FULL", "COLLECTOR", "NONE"];

// Ödeme modülü yetki yönetimi.
//
// Denetim izi "kim yaptı"yı kaydeder; bu ekran "kim yapabilir"i belirler.
// İkisi birlikte anlamlı: iz olmadan yetki denetlenemez, yetki olmadan iz
// sadece hasarı sonradan gösterir.
export function StaffRolesCard() {
  const { showError, showSuccess } = useToast();
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  function load() {
    fetch("/api/payments/principal/staff-roles")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((d) => setStaff(d.admins ?? []))
      .catch(() => showError("Yetkiler yüklenemedi."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function change(adminId: string, paymentRole: PaymentRole) {
    setSavingId(adminId);
    try {
      const res = await fetch("/api/payments/principal/staff-roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, paymentRole }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error);
      showSuccess("Yetki güncellendi.");
      load();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Yetki güncellenemedi.");
      load();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <ShieldHalf className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Ödeme Yetkileri
      </h3>
      <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">
        Tahsildar yetkisi tahsilat alır ve borç görür; gider, bordro, virman, iptal ve iade yapamaz.
      </p>

      {!staff ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {staff.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-hairline p-3 dark:border-white/5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-espresso dark:text-cream">
                  {s.name}
                  {s.isSelf && <span className="ml-1.5 text-[10px] font-normal text-espresso-muted dark:text-cream/40">(siz)</span>}
                </p>
                <p className="truncate text-[11px] text-espresso-muted dark:text-cream/40">
                  {s.title} · {PAYMENT_ROLE_DESCRIPTION[s.paymentRole]}
                </p>
              </div>
              <select
                value={s.paymentRole}
                disabled={s.isSelf || savingId === s.id}
                onChange={(e) => change(s.id, e.target.value as PaymentRole)}
                // Kendi yetkisini değiştirmek engelli: hem kilitlenmeyi
                // hem de kendine tam yetki verme yolunu kapatır.
                title={s.isSelf ? "Kendi ödeme yetkinizi değiştiremezsiniz." : undefined}
                className="shrink-0 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-emerald-500 disabled:opacity-40 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {PAYMENT_ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
