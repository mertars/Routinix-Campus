"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark, Upload, Loader2, CheckCircle2, AlertTriangle, EyeOff, Info, RefreshCw } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import type { AccountRow } from "@/components/payments/payments-principal-panel";

type Candidate = {
  studentId: string;
  studentName: string;
  studentNumber: string;
  branchName: string;
  openDebt: number;
  score: number;
  reasons: string[];
};
type OpenInstallment = { id: string; title: string; dueDate: string; remaining: number };
type Row = {
  id: string;
  transactionDate: string;
  amount: number;
  description: string;
  bankReference: string | null;
  suggestedStudentId: string | null;
  candidates: Candidate[];
};
type Payload = { rows: Row[]; installmentsByStudent: Record<string, OpenInstallment[]>; count: number };

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

// Banka ekstresi eşleştirme ekranı.
//
// Bugüne kadar sekreter ekstreyi açıp açıklamaya bakarak hangi öğrenci
// olduğunu tahmin ediyor, sonra tahsilatı elle giriyordu. Yüz
// öğrencili bir kurumda ay başında saatler.
//
// Akış bilerek İKİ ADIMLI: önce satırlar alınır ve eşleştirme
// ÖNERİLİR, sonra insan onaylayınca tahsilat yazılır. Para yazmak geri
// alınması en zor işlemlerden biri; sistem asla kendiliğinden yazmaz.
export function BankImportTab({ accounts, onChanged }: { accounts: AccountRow[]; onChanged: () => void }) {
  const { showError, showSuccess } = useToast();
  const [accountId, setAccountId] = useState("");
  const [rawText, setRawText] = useState("");
  const [importing, setImporting] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  // Satır başına seçim: hangi öğrenci ve hangi taksit.
  const [picks, setPicks] = useState<Record<string, { studentId: string; installmentId: string }>>({});

  const bankAccounts = accounts.filter((a) => a.type === "BANK");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/principal/bank-import");
      const payload = res.ok ? ((await res.json()) as Payload) : null;
      setData(payload);

      // Önerilen eşleşmeler ÖNCEDEN seçili gelir ve taksit olarak en
      // eski açık taksit varsayılır — sekreterin çoğu satırda hiçbir
      // şey yapmaması, yalnızca gözden geçirip onaylaması hedeflenir.
      if (payload) {
        const next: Record<string, { studentId: string; installmentId: string }> = {};
        for (const row of payload.rows) {
          if (!row.suggestedStudentId) continue;
          const installments = payload.installmentsByStudent[row.suggestedStudentId] ?? [];
          if (installments.length === 0) continue;
          next[row.id] = { studentId: row.suggestedStudentId, installmentId: installments[0].id };
        }
        setPicks(next);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (bankAccounts.length > 0 && !accountId) setAccountId(bankAccounts[0].id);
  }, [bankAccounts, accountId]);

  async function handleImport() {
    if (!accountId || !rawText.trim()) {
      showError("Hesap seçin ve ekstre içeriğini yapıştırın.");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/payments/principal/bank-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, rawText }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "İçe aktarılamadı.");

      const parcalar = [`${d.imported} yeni satır`];
      if (d.duplicates > 0) parcalar.push(`${d.duplicates} satır zaten vardı`);
      if (d.skipped?.length > 0) parcalar.push(`${d.skipped.length} satır atlandı`);
      showSuccess(parcalar.join(" · "));

      // Atlanan satırların SEBEBİ gösterilir: sessizce kaybolmamalı.
      if (d.skipped?.length > 0) {
        showError(d.skipped.slice(0, 3).map((s: { lineNumber: number; reason: string }) => `Satır ${s.lineNumber}: ${s.reason}`).join(" | "));
      }
      setRawText("");
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : "İçe aktarılamadı.");
    } finally {
      setImporting(false);
    }
  }

  async function confirmAll() {
    const matches = Object.entries(picks).map(([transactionId, p]) => ({ transactionId, ...p }));
    if (matches.length === 0) return showError("Onaylanacak eşleşme seçilmedi.");
    if (!window.confirm(`${matches.length} satır tahsilata dönüştürülecek. Bu işlem para kaydı oluşturur.\n\nOnaylıyor musunuz?`)) return;

    setConfirming(true);
    try {
      const res = await fetch("/api/payments/principal/bank-import?confirm=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matches }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "Onaylanamadı.");

      if (d.failed > 0) {
        const ilk = (d.results ?? []).find((r: { ok: boolean }) => !r.ok);
        showError(`${d.succeeded} tahsilat oluştu, ${d.failed} satır olmadı. Örnek: ${ilk?.reason ?? ""}`);
      } else {
        showSuccess(`${d.succeeded} tahsilat oluşturuldu.`);
      }
      setPicks({});
      await load();
      onChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Onaylanamadı.");
    } finally {
      setConfirming(false);
    }
  }

  async function ignoreRow(id: string) {
    const reason = window.prompt("Bu satır neden öğrenci ödemesi değil? (banka masrafı, iade, kurum içi transfer...)");
    if (reason === null) return;
    try {
      const res = await fetch(`/api/payments/principal/bank-import?ignore=${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "İşlem başarısız.");
      showSuccess("Satır yok sayıldı.");
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : "İşlem başarısız.");
    }
  }

  const secili = Object.keys(picks).length;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-midnight-card/50">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Landmark className="h-4 w-4 text-brand-600" /> Banka Ekstresi Aktar
        </h2>
        <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">
          Bankanızın CSV/Excel dışa aktarımını yapıştırın. Sütunlar adlarından tanınır; aynı ekstreyi iki kez
          yüklerseniz satırlar tekrar eklenmez.
        </p>

        {bankAccounts.length === 0 ? (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-500/10">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Önce Kasa &amp; Banka sekmesinden bir <strong>banka</strong> hesabı ekleyin.
            </p>
          </div>
        ) : (
          <>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mb-2 w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
            >
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={5}
              placeholder={"Tarih;Açıklama;Tutar;Referans No\n12.09.2026;AHMET KAYA 2026-1042 EGITIM;12.000,00;R001"}
              className="mb-2 w-full rounded-xl border border-hairline bg-white px-3 py-2 font-mono text-[11px] text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} İçe Aktar
            </button>
          </>
        )}
      </div>

      <div className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-midnight-card/50">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-espresso dark:text-cream">Eşleştirme Bekleyenler</h2>
            <p className="text-[11px] text-espresso-muted dark:text-cream/40">
              {loading ? "Yükleniyor..." : `${data?.count ?? 0} satır · ${secili} tanesi seçili`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} aria-label="Yenile" className="text-espresso-muted transition hover:text-brand-600 dark:text-cream/40">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
            <button
              onClick={confirmAll}
              disabled={confirming || secili === 0}
              className="flex items-center gap-1.5 rounded-xl bg-espresso px-4 py-2 text-sm font-medium text-cream transition hover:bg-caramel disabled:opacity-40 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {secili} Satırı Tahsilata Dönüştür
            </button>
          </div>
        </div>

        {!loading && (data?.rows.length ?? 0) === 0 && (
          <p className="py-8 text-center text-xs text-espresso-muted dark:text-cream/40">
            Eşleştirme bekleyen satır yok.
          </p>
        )}

        <div className="space-y-2">
          {data?.rows.map((row) => {
            const pick = picks[row.id];
            const installments = pick ? (data.installmentsByStudent[pick.studentId] ?? []) : [];
            return (
              <div
                key={row.id}
                className={cn(
                  "rounded-xl border p-3",
                  pick ? "border-emerald-500/40 bg-emerald-500/[0.03]" : "border-hairline dark:border-white/10"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-espresso dark:text-cream">
                      {formatTRY(row.amount)}
                      <span className="ml-2 text-[11px] font-normal text-espresso-muted dark:text-cream/40">
                        {new Date(row.transactionDate).toLocaleDateString("tr-TR")}
                      </span>
                    </p>
                    <p className="truncate font-mono text-[11px] text-espresso-muted dark:text-cream/50">{row.description}</p>
                  </div>
                  <button
                    onClick={() => ignoreRow(row.id)}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-[11px] text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/40"
                  >
                    <EyeOff className="h-3 w-3" /> Öğrenci ödemesi değil
                  </button>
                </div>

                {row.candidates.length === 0 ? (
                  <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-cream-card px-2.5 py-2 dark:bg-white/5">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-espresso-muted dark:text-cream/40" />
                    <p className="text-[11px] text-espresso-muted dark:text-cream/40">
                      Açıklamada öğrenciye işaret eden bir bilgi yok. Öğrenci Ödemeleri sekmesinden elle tahsilat
                      girebilir ya da bu satırı yok sayabilirsiniz.
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {row.candidates.map((c) => {
                      const secili = pick?.studentId === c.studentId;
                      const kendiTaksitleri = data.installmentsByStudent[c.studentId] ?? [];
                      return (
                        <button
                          key={c.studentId}
                          onClick={() =>
                            setPicks((prev) => {
                              if (secili) {
                                const { [row.id]: _sil, ...kalan } = prev;
                                return kalan;
                              }
                              if (kendiTaksitleri.length === 0) return prev;
                              return { ...prev, [row.id]: { studentId: c.studentId, installmentId: kendiTaksitleri[0].id } };
                            })
                          }
                          disabled={kendiTaksitleri.length === 0}
                          className={cn(
                            "flex w-full flex-wrap items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] transition",
                            secili ? "bg-emerald-500/10 ring-1 ring-emerald-500" : "bg-cream-card hover:bg-white dark:bg-white/5 dark:hover:bg-white/10",
                            kendiTaksitleri.length === 0 && "opacity-50"
                          )}
                        >
                          <span className="font-medium text-espresso dark:text-cream">{c.studentName}</span>
                          <span className="text-espresso-muted dark:text-cream/40">
                            {c.studentNumber} · {c.branchName}
                          </span>
                          {/* Puanın kendisi değil, GEREKÇESİ gösterilir —
                              sekreter kararı denetleyebilmeli. */}
                          <span className="text-espresso-muted dark:text-cream/40">· {c.reasons.join(", ")}</span>
                          {kendiTaksitleri.length === 0 && (
                            <span className="text-amber-700 dark:text-amber-400">· açık taksiti yok</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {pick && installments.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-espresso-muted dark:text-cream/40">Hangi taksite işlensin:</span>
                    <select
                      value={pick.installmentId}
                      onChange={(e) => setPicks((prev) => ({ ...prev, [row.id]: { ...pick, installmentId: e.target.value } }))}
                      className="rounded-lg border border-hairline bg-white px-2 py-1 text-[11px] text-espresso outline-none dark:border-white/10 dark:bg-midnight dark:text-cream"
                    >
                      {installments.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.title} · kalan {formatTRY(i.remaining)} · vade {new Date(i.dueDate).toLocaleDateString("tr-TR")}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
