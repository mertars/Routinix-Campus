"use client";

import { useEffect, useState } from "react";
import { Loader2, Handshake, CheckCircle2, AlertTriangle, Clock, X } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

export type PromiseRow = {
  id: string;
  studentId: string;
  studentName: string;
  branchName: string;
  promisedAmount: number;
  paidSince: number;
  promisedDate: string;
  note: string | null;
  state: "PENDING" | "KEPT" | "BROKEN" | "CLOSED";
  createdBy: string;
};

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

const STATE_META: Record<PromiseRow["state"], { label: string; className: string; icon: typeof Clock }> = {
  PENDING: { label: "Bekleniyor", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300", icon: Clock },
  KEPT: { label: "Tutuldu", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 },
  BROKEN: { label: "Tutulmadı", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300", icon: AlertTriangle },
  CLOSED: { label: "Kapatıldı", className: "bg-gray-500/10 text-gray-600 dark:text-gray-400", icon: X },
};

// Ödeme sözleri kartı — müdürün "bugün kimi aramalıyım" listesi.
// Tutulan sözler listeden düşer (veli ödeyince söz kendiliğinden kapanır),
// böylece liste hep aksiyon gerektirenleri gösterir.
export function PromisesCard({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const { showError, showSuccess } = useToast();
  const [rows, setRows] = useState<PromiseRow[] | null>(null);

  function load() {
    fetch("/api/payments/principal/promises")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => setRows(d.promises ?? []))
      .catch(() => showError("Ödeme sözleri yüklenemedi."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function close(id: string) {
    const reason = window.prompt("Söz neden kapatılıyor? (örn. yapılandırmaya gidildi)");
    if (reason === null) return;
    const res = await fetch("/api/payments/principal/promises", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, closedReason: reason.trim() || undefined }),
    });
    if (res.ok) {
      showSuccess("Söz kapatıldı.");
      load();
      onChanged();
    } else showError("Söz kapatılamadı.");
  }

  // Aksiyon gerektirenler önce: tutulmayanlar, sonra bekleyenler.
  const active = (rows ?? []).filter((r) => r.state === "BROKEN" || r.state === "PENDING");
  const sorted = [...active].sort((a, b) => (a.state === b.state ? a.promisedDate.localeCompare(b.promisedDate) : a.state === "BROKEN" ? -1 : 1));

  if (rows && active.length === 0) return null;

  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <Handshake className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Ödeme Sözleri
        {sorted.length > 0 && <span className="font-normal text-espresso-muted dark:text-cream/40">({sorted.length} takip)</span>}
      </h3>

      {!rows ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((p) => {
            const meta = STATE_META[p.state];
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
                  p.state === "BROKEN" ? "border-rose-400/25 bg-rose-500/5" : "border-hairline dark:border-white/5"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-espresso dark:text-cream">{p.studentName}</p>
                  <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">
                    {formatTRY(p.promisedAmount)} · {new Date(p.promisedDate).toLocaleDateString("tr-TR")} sözü
                    {p.paidSince > 0 ? ` · ${formatTRY(p.paidSince)} ödendi` : ""}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold", meta.className)}>
                    <meta.icon className="h-3 w-3" /> {meta.label}
                  </span>
                  <button
                    onClick={() => close(p.id)}
                    aria-label="Sözü kapat"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-espresso-muted transition hover:bg-cream-card dark:text-cream/40 dark:hover:bg-white/5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
