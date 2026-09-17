"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileSearch, Loader2, ShieldAlert, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

// ETKİNLİK RAPORU EKRANI — "kim ne yaptı" dökümü, kanıt olarak.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-17): "olası bir öğretmen şikâyetinde kendi
// /platform hesabımdan rapor çıkarıp kimin ne yaptığını kanıt olarak
// sunabileyim. Günlük, haftalık, aylık, 3 aylık rapor alabileyim."
//
// Ekranın kurgusu üç katman:
//   1. KİŞİ ÖZETİ — kim kaç işlem yapmış (şikâyette ilk bakılan yer).
//   2. GÜN DAĞILIMI — hangi gün yoğunluk var.
//   3. SATIR SATIR DÖKÜM — zaman damgalı kanıt; CSV olarak indirilebilir.
//
// ⚠️ "Yönetici tarafından" sütunu kritik: bir işlem, yöneticinin o kişinin
// panelinden yaptığı bir düzeltmeyse orada yazar. Şikâyetin cevabı çoğu
// zaman tam olarak budur.

type ActorRow = { actorId: string; actorName: string; actorRole: string; count: number };
type LogRow = {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  onBehalfOfName: string | null;
  onBehalfOfRole: string | null;
  summary: string;
  category: string;
  action: string;
  method: string;
  route: string;
  status: number;
};
type Report = {
  institution: { id: string; name: string };
  period: string;
  from: string;
  to: string;
  total: number;
  truncated: boolean;
  byActor: ActorRow[];
  byDay: { date: string; count: number }[];
  rows: LogRow[];
};

const PERIODS: { id: string; label: string }[] = [
  { id: "day", label: "Bugün" },
  { id: "week", label: "Son 7 gün" },
  { id: "month", label: "Son 30 gün" },
  { id: "quarter", label: "Son 3 ay" },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Yönetici",
  TEACHER: "Öğretmen",
  GUIDANCE: "Rehberlik",
  STUDENT: "Öğrenci",
  PARENT: "Veli",
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ActivityReport({
  isOpen,
  onClose,
  institutions,
}: {
  isOpen: boolean;
  onClose: () => void;
  institutions: { id: string; name: string }[];
}) {
  const [institutionId, setInstitutionId] = useState("");
  const [period, setPeriod] = useState("week");
  const [actorId, setActorId] = useState<string | null>(null);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isOpen && !institutionId && institutions[0]) setInstitutionId(institutions[0].id);
  }, [isOpen, institutions, institutionId]);

  useEffect(() => {
    if (!isOpen || !institutionId) return;
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams({ institutionId, period });
    if (actorId) params.set("actorId", actorId);
    fetch(`/api/platform/activity-report?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [isOpen, institutionId, period, actorId]);

  const maxDay = useMemo(() => Math.max(1, ...(data?.byDay ?? []).map((d) => d.count)), [data]);

  function downloadCsv() {
    if (!data) return;
    // Excel'in tr-TR ayarı için BOM + noktalı virgül (sistemdeki diğer
    // dışa aktarmalarla aynı kural).
    const head = ["Tarih", "Yönetici", "Ne yaptı", "Tür", "Panelinden", "Sonuç", "Uç"];
    const lines = data.rows.map((r) => [
      when(r.at),
      r.actorName,
      r.summary,
      r.category,
      r.onBehalfOfName ? `${r.onBehalfOfName} panelinden` : "kendi paneli",
      r.status >= 400 ? "başarısız" : "başarılı",
      r.route,
    ]);
    const csv = "﻿" + [head, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `etkinlik-raporu-${data.institution.name}-${period}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const selectedActor = data?.byActor.find((a) => a.actorId === actorId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Etkinlik Raporu" variant="center" widthClassName="max-w-5xl">
      <div className="space-y-3.5">
        <div className="flex gap-2.5 rounded-2xl border border-hairline bg-cream-card/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p className="text-[11.5px] leading-relaxed text-espresso dark:text-cream/70">
            <strong>Yöneticinin yaptığı her değişiklik</strong> zaman damgası ve detayıyla burada — &quot;9-A
            şubesinin 17.09.2026 yoklamasını aldı&quot; gibi. Yönetici yapmadıysa işlem tanım gereği kişinin kendisine
            aittir, o yüzden yalnızca yönetici eylemleri tutulur. Kayıtlar <strong>90 gün</strong> saklanır.{" "}
            <strong>&quot;Panelinden&quot;</strong> sütunu, yöneticinin işlemi kimin ekranından yaptığını gösterir.
          </p>
        </div>

        {/* Filtreler */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={institutionId}
            onChange={(e) => {
              setInstitutionId(e.target.value);
              setActorId(null);
            }}
            className="min-h-[38px] rounded-xl border border-hairline bg-white px-3 text-[12.5px] text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          >
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "min-h-[38px] rounded-xl border px-3 text-[12.5px] font-medium transition",
                period === p.id
                  ? "border-espresso bg-espresso text-cream dark:border-brand-500 dark:bg-brand-600 dark:text-white"
                  : "border-hairline bg-white/70 text-espresso-muted hover:border-brand-500/40 dark:border-white/10 dark:bg-white/5 dark:text-cream/55"
              )}
            >
              {p.label}
            </button>
          ))}
          {actorId && (
            <button
              onClick={() => setActorId(null)}
              className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-brand-500 bg-brand-50 px-3 text-[12px] font-semibold text-brand-700 dark:bg-brand-600/15 dark:text-brand-300"
            >
              {selectedActor?.actorName ?? "Kişi"} <X className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={downloadCsv}
            disabled={!data || data.rows.length === 0}
            className="ml-auto flex min-h-[38px] items-center gap-1.5 rounded-xl bg-espresso px-3 text-[12.5px] font-semibold text-cream transition hover:bg-caramel disabled:opacity-40 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <Download className="h-3.5 w-3.5" /> CSV indir
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        )}
        {failed && <p className="py-12 text-center text-sm text-espresso-muted dark:text-cream/40">Rapor yüklenemedi.</p>}

        {data && !loading && (
          <>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              {/* 1. Kişi özeti */}
              <div className="rounded-2xl border border-hairline bg-white p-3.5 dark:border-white/10 dark:bg-midnight-card/50">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                  Kişi bazlı ({data.total} işlem)
                </p>
                {data.byActor.length === 0 ? (
                  <p className="py-6 text-center text-[12px] text-espresso-muted dark:text-cream/40">
                    Bu dönemde kayıt yok.
                  </p>
                ) : (
                  <div className="max-h-[300px] space-y-1 overflow-y-auto">
                    {data.byActor.map((a) => (
                      <button
                        key={a.actorId}
                        onClick={() => setActorId(actorId === a.actorId ? null : a.actorId)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition",
                          actorId === a.actorId ? "bg-brand-500/12 ring-1 ring-brand-500/40" : "hover:bg-cream-card dark:hover:bg-white/5"
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium text-espresso dark:text-cream">
                            {a.actorName || "—"}
                          </span>
                          <span className="block text-[10.5px] text-espresso-muted dark:text-cream/40">
                            {ROLE_LABEL[a.actorRole] ?? a.actorRole}
                          </span>
                        </span>
                        <span className="shrink-0 text-[13px] font-bold tabular-nums text-espresso dark:text-cream">
                          {a.count}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Gün dağılımı */}
              <div className="rounded-2xl border border-hairline bg-white p-3.5 dark:border-white/10 dark:bg-midnight-card/50">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                  Gün dağılımı
                </p>
                {data.byDay.length === 0 ? (
                  <p className="py-6 text-center text-[12px] text-espresso-muted dark:text-cream/40">Kayıt yok.</p>
                ) : (
                  <div className="flex h-[280px] items-end justify-start gap-1 overflow-x-auto">
                    {data.byDay.map((d) => (
                      // ⚠️ max-w: tek günlük raporda çubuk tüm genişliği
                      // kaplayıp grafik gibi değil dolu bir blok gibi
                      // görünüyordu.
                      <div key={d.date} className="flex min-w-[26px] max-w-[60px] flex-1 flex-col items-center gap-1">
                        <span className="text-[9.5px] tabular-nums text-espresso-muted dark:text-cream/35">{d.count}</span>
                        <div
                          className="w-full rounded-t bg-brand-500/70"
                          style={{ height: `${Math.max(3, (d.count / maxDay) * 220)}px` }}
                        />
                        <span className="whitespace-nowrap text-[9px] text-espresso-muted dark:text-cream/30">
                          {d.date.slice(8, 10)}.{d.date.slice(5, 7)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Satır satır döküm */}
            <div className="rounded-2xl border border-hairline bg-white p-3.5 dark:border-white/10 dark:bg-midnight-card/50">
              <p className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                Döküm
                {data.truncated && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold normal-case text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    en yeni {data.rows.length} satır gösteriliyor · daraltmak için bir kişi seçin
                  </span>
                )}
              </p>
              {data.rows.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-espresso-muted dark:text-cream/40">
                  Bu dönemde kayıt yok.
                </p>
              ) : (
                <div className="max-h-[360px] overflow-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead className="sticky top-0 bg-white dark:bg-midnight-card">
                      <tr className="border-b border-hairline text-[10.5px] uppercase tracking-wide text-espresso-muted dark:border-white/10 dark:text-cream/40">
                        <th className="pb-1.5 font-semibold">Tarih</th>
                        <th className="pb-1.5 font-semibold">Kişi</th>
                        <th className="pb-1.5 font-semibold">Ne yaptı</th>
                        <th className="pb-1.5 font-semibold">Tür</th>
                        <th className="pb-1.5 font-semibold">Panelinden</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r) => (
                        <tr key={r.id} className="border-b border-hairline/60 last:border-0 dark:border-white/5">
                          <td className="whitespace-nowrap py-1.5 pr-3 text-[11.5px] tabular-nums text-espresso-muted dark:text-cream/50">
                            {when(r.at)}
                          </td>
                          <td className="py-1.5 pr-3 text-[12px] font-medium text-espresso dark:text-cream">
                            {r.actorName}
                            <span className="ml-1 text-[10px] font-normal text-espresso-muted dark:text-cream/35">
                              {ROLE_LABEL[r.actorRole] ?? r.actorRole}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 text-[12px] leading-snug text-espresso dark:text-cream/80">
                            {r.summary}
                          </td>
                          <td className="py-1.5 pr-3 text-[11.5px] text-espresso-muted dark:text-cream/45">
                            {r.category}
                            {r.status >= 400 && (
                              <span className="ml-1 rounded bg-rose-100 px-1 text-[9.5px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                                başarısız
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 text-[11.5px]">
                            {r.onBehalfOfName ? (
                              <span className="flex items-center gap-1 font-semibold text-red-700 dark:text-red-400">
                                <ShieldAlert className="h-3 w-3" /> {r.onBehalfOfName} panelinden
                              </span>
                            ) : (
                              <span className="text-espresso-muted/60 dark:text-cream/25">kendisi</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
