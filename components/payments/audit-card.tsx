"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { ACTION_FLOW, type AuditFlow, type PaymentAuditAction } from "@/lib/payments/audit-actions";

type Entry = {
  id: string;
  action: PaymentAuditAction;
  actionLabel: string;
  actorName: string;
  amount: number;
  summary: string;
  targetType: string;
  targetId: string;
  createdAt: string;
};

type AuditPayload = {
  entries: Entry[];
  actors: { id: string; name: string }[];
  actions: { value: string; label: string }[];
  limit: number;
};

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("tr-TR")} ${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
}

// Finansal denetim izi. Para hareketi olan her eylem burada; salt okuma
// (rapor görüntüleme, PDF indirme) BİLEREK yok — iz gürültüyle dolarsa
// asıl olayı bulmak imkânsızlaşır.
export function AuditCard() {
  const { showError } = useToast();
  const [data, setData] = useState<AuditPayload | null>(null);
  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");
  const [days, setDays] = useState(30);

  useEffect(() => {
    setData(null);
    const q = new URLSearchParams({ days: String(days) });
    if (action) q.set("action", action);
    if (actorId) q.set("actorId", actorId);
    fetch(`/api/payments/principal/audit?${q.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((d: AuditPayload) => setData(d))
      .catch(() => showError("Denetim izi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, actorId, days]);

  const selectClass =
    "rounded-full border border-hairline bg-white px-2.5 py-1.5 text-[11px] text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream";

  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
      <div className="mb-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Denetim İzi
        </h3>
        <p className="text-[11px] text-espresso-muted dark:text-cream/40">
          Para hareketi veya borç değiştiren her işlem — kim, ne zaman, ne kadar.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={selectClass}>
          <option value={7}>Son 7 gün</option>
          <option value={30}>Son 30 gün</option>
          <option value={90}>Son 90 gün</option>
          <option value={365}>Son 1 yıl</option>
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} className={selectClass}>
          <option value="">Tüm işlemler</option>
          {(data?.actions ?? []).map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <select value={actorId} onChange={(e) => setActorId(e.target.value)} className={selectClass}>
          <option value="">Tüm kullanıcılar</option>
          {(data?.actors ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {!data ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : data.entries.length === 0 ? (
        <p className="py-8 text-center text-xs text-espresso-muted dark:text-cream/40">
          Bu filtreye uyan bir işlem yok.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            {data.entries.map((e) => {
              const flow: AuditFlow = ACTION_FLOW[e.action] ?? "NEUTRAL";
              const FlowIcon = flow === "IN" ? ArrowDownRight : flow === "OUT" ? ArrowUpRight : Minus;
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-hairline px-3 py-2 dark:border-white/5"
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      flow === "OUT"
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : flow === "IN"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-espresso/5 text-espresso-muted dark:bg-white/5 dark:text-cream/40"
                    )}
                  >
                    <FlowIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-espresso dark:text-cream">
                      {e.actionLabel}
                      {e.summary && <span className="font-normal text-espresso-muted dark:text-cream/50"> · {e.summary}</span>}
                    </p>
                    <p className="text-[10px] text-espresso-muted dark:text-cream/40">
                      {e.actorName} · {formatWhen(e.createdAt)}
                    </p>
                  </div>
                  {e.amount > 0 && (
                    <span
                      className={cn(
                        "shrink-0 text-xs font-semibold tabular-nums",
                        flow === "OUT"
                          ? "text-rose-600 dark:text-rose-400"
                          : flow === "IN"
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-espresso-muted dark:text-cream/50"
                      )}
                    >
                      {/* Nötr eylemlerde işaret YOK — virman kuruma para
                          girmesi değildir, "+" yanıltıcı olurdu. */}
                      {flow === "OUT" ? "−" : flow === "IN" ? "+" : ""}
                      {formatTRY(e.amount)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {data.entries.length >= data.limit && (
            <p className="mt-2 text-center text-[10px] text-espresso-muted dark:text-cream/40">
              En yeni {data.limit} kayıt gösteriliyor — daralt­mak için filtreleri kullanın.
            </p>
          )}
        </>
      )}
    </div>
  );
}
