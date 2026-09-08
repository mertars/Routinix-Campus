"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp, AlertTriangle, ChevronDown, Info, Wallet } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type CashflowMonth = {
  key: string;
  label: string;
  opening: number;
  plannedIncome: number;
  expectedIncome: number;
  knownExpense: number;
  estimatedExpense: number;
  expectedExpense: number;
  closing: number;
  isNegative: boolean;
};

type Cashflow = {
  months: CashflowMonth[];
  firstNegativeMonth: string | null;
  lowestClosing: number;
  basis: {
    openingBalance: number;
    collectionRate: number;
    collectionRateWindowMonths: number;
    monthlyPayroll: number;
    recurringLookbackMonths: number;
    recurringTemplateTotal: number;
    hasCollectionHistory: boolean;
    hasExpenseHistory: boolean;
    recurringByCategory: { categoryId: string; categoryName: string; monthlyAmount: number }[];
    overdueBacklog: number;
  };
};

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

// Nakit akışı projeksiyonu — panelin tek İLERİYE dönük görünümü.
// Tahminin varsayımları katlanır bir bölümde açıkça listelenir; müdür
// rakama ancak nereden geldiğini görebiliyorsa güvenir.
export function CashflowCard() {
  const { showError } = useToast();
  const [data, setData] = useState<Cashflow | null>(null);
  const [months, setMonths] = useState(6);
  const [showBasis, setShowBasis] = useState(false);

  useEffect(() => {
    setData(null);
    fetch(`/api/payments/principal/cashflow?months=${months}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((d: Cashflow) => setData(d))
      .catch(() => showError("Nakit akışı projeksiyonu yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);

  const scale = Math.max(1, ...(data?.months ?? []).map((m) => Math.max(m.expectedIncome, m.expectedExpense)));

  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Nakit Akışı Projeksiyonu
          </h3>
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">
            Taksit planı, girilmiş giderler ve bordro profillerinden ileriye dönük tahmin.
          </p>
        </div>
        <div className="flex gap-1.5">
          {[3, 6, 12].map((m) => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                months === m
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50"
              )}
            >
              {m} ay
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          {/* Geçmişi olmayan kurumda tahmin GÜVENİLMEZ; bunu söylemeden
              rakam göstermek, hiç göstermemekten kötüdür. */}
          {(!data.basis.hasCollectionHistory || (!data.basis.hasExpenseHistory && data.basis.recurringTemplateTotal === 0)) && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/5 p-3 text-[11px] text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Bu tahmin henüz oturmadı.</strong>{" "}
                {!data.basis.hasCollectionHistory && "Vadesi geçmiş taksit geçmişi olmadığı için tahsilat oranı %100 varsayıldı. "}
                {!data.basis.hasExpenseHistory && data.basis.recurringTemplateTotal === 0 && "Geçmiş gider kaydı ve tekrar eden gider şablonu yok; sabit giderler tahmine girmiyor. "}
                Birkaç ay veri biriktikçe ya da tekrar eden giderlerinizi tanımladıkça isabet artar.
              </span>
            </div>
          )}

          {data.firstNegativeMonth ? (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/5 p-3 text-[11px] text-rose-800 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{data.months.find((m) => m.key === data.firstNegativeMonth)?.label}</strong> ayında nakit eksiye
                düşüyor (en düşük: {formatTRY(data.lowestClosing)}). Tahsilatı hızlandırmayı veya gider takvimini
                kaydırmayı değerlendirin.
              </span>
            </div>
          ) : (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-3 text-[11px] text-emerald-800 dark:text-emerald-300">
              <Wallet className="h-3.5 w-3.5 shrink-0" />
              Projeksiyon boyunca nakit pozitif kalıyor. En düşük bakiye: {formatTRY(data.lowestClosing)}
            </div>
          )}

          <div className="space-y-1.5">
            {data.months.map((m) => (
              <div key={m.key} className="rounded-xl border border-hairline p-2.5 dark:border-white/5">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-espresso dark:text-cream">{m.label}</span>
                  <span
                    className={cn(
                      "text-xs font-bold",
                      m.isNegative ? "text-rose-600 dark:text-rose-400" : "text-espresso dark:text-cream"
                    )}
                  >
                    {formatTRY(m.closing)}
                  </span>
                </div>
                {/* Gelir ve gider çubukları aynı ölçeğe göre — hangisinin
                    ağır bastığı bakışta görünsün */}
                <div className="space-y-1">
                  <Bar value={m.expectedIncome} scale={scale} tone="bg-emerald-500" label="Gelir" />
                  <Bar value={m.expectedExpense} scale={scale} tone="bg-rose-400" label="Gider" />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowBasis((v) => !v)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-hairline py-2 text-[11px] font-medium text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
          >
            <Info className="h-3.5 w-3.5" /> Tahmin nasıl hesaplandı?
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showBasis && "rotate-180")} />
          </button>

          {showBasis && (
            <div className="mt-2 space-y-2 rounded-xl border border-hairline bg-cream-card/50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <BasisRow
                label="Başlangıç bakiyesi"
                value={formatTRY(data.basis.openingBalance)}
                hint="Tüm kasa ve banka hesaplarının toplamı"
              />
              <BasisRow
                label="Tahsilat oranı"
                value={data.basis.hasCollectionHistory ? `%${Math.round(data.basis.collectionRate * 100)}` : "veri yok"}
                hint={
                  data.basis.hasCollectionHistory
                    ? `Son ${data.basis.collectionRateWindowMonths} ayda vadesi gelen taksitlerin tahsil edilen kısmı. Beklenen gelir bu oranla çarpılır.`
                    : "Vadesi geçmiş taksit geçmişi yok; herkesin ödeyeceği (%100) varsayıldı."
                }
              />
              <BasisRow
                label="Aylık bordro"
                value={formatTRY(data.basis.monthlyPayroll)}
                hint="Aktif personel ücret profillerinden hesaplanır, geçmiş ortalamadan değil"
              />
              <BasisRow
                label="Vadesi geçmiş alacak"
                value={formatTRY(data.basis.overdueBacklog)}
                hint="Projeksiyona DAHİL DEĞİLDİR — tahsil edilirse ek nakit demektir"
              />

              {data.basis.recurringByCategory.length > 0 && (
                <div className="border-t border-hairline pt-2 dark:border-white/10">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                    Aylık düzenli gider beklentisi
                  </p>
                  {data.basis.recurringByCategory.map((c) => (
                    <div key={c.categoryId} className="flex justify-between text-[11px]">
                      <span className="text-espresso-muted dark:text-cream/50">{c.categoryName}</span>
                      <span className="text-espresso dark:text-cream/80">{formatTRY(c.monthlyAmount)}</span>
                    </div>
                  ))}
                  <p className="mt-1.5 text-[10px] leading-relaxed text-espresso-muted dark:text-cream/40">
                    Son {data.basis.recurringLookbackMonths} ayın ortalaması ile{" "}
                    <strong>tekrar eden gider şablonlarınızın</strong> büyüğü alınır. Bir ay için gider zaten girilmişse o
                    kategoride <strong>girilen rakam</strong> kullanılır — ikisi toplanmaz. Bu ay <strong>ödenmiş</strong>{" "}
                    giderler başlangıç bakiyesinden zaten düştüğü için ilk ayın tahmininden çıkarılır.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Bar({ value, scale, tone, label }: { value: number; scale: number; tone: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 shrink-0 text-[10px] text-espresso-muted dark:text-cream/40">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-espresso/5 dark:bg-white/10">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, (value / scale) * 100)}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right text-[10px] tabular-nums text-espresso-muted dark:text-cream/50">
        {formatTRY(value)}
      </span>
    </div>
  );
}

function BasisRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <div className="flex justify-between text-[11px]">
        <span className="text-espresso-muted dark:text-cream/50">{label}</span>
        <span className="font-semibold text-espresso dark:text-cream">{value}</span>
      </div>
      <p className="text-[10px] leading-relaxed text-espresso-muted dark:text-cream/35">{hint}</p>
    </div>
  );
}
