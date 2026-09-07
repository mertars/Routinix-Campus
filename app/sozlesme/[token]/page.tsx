"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, FileText, ShieldCheck, AlertTriangle } from "lucide-react";
import { SignaturePad } from "@/components/contracts/signature-pad";
import { spaceGrotesk, GlowLogo } from "@/components/ui/aurora-brand";
import { cn } from "@/lib/utils";

type ContractView = {
  title: string;
  content: string;
  status: "DRAFT" | "SENT" | "SIGNED" | "CANCELLED";
  institutionName: string;
  studentName: string;
  totalAmount: number | null;
  installmentCount: number | null;
  signerName: string | null;
  signerRelation: string | null;
  signatureData: string | null;
  signedAt: string | null;
};

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

// Velinin OTURUM AÇMADAN sözleşmeyi okuyup imzaladığı public sayfa.
// Kimlik doğrulaması URL'deki token'dır (bkz. contract-service >
// resolveContractToken); middleware bu rotayı korumaz.
export default function ContractSigningPage({ params }: { params: { token: string } }) {
  const [contract, setContract] = useState<ContractView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerRelation, setSignerRelation] = useState("Veli");
  const [signature, setSignature] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch(`/api/contracts/shared/${encodeURIComponent(params.token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Sözleşme yüklenemedi.");
        return data as ContractView;
      })
      .then((data) => {
        setContract(data);
        if (data.signerName) setSignerName(data.signerName);
      })
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSign() {
    if (!signerName.trim()) return setError("Lütfen ad soyad giriniz.");
    if (!signature) return setError("Lütfen imzanızı çiziniz.");
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/shared/${encodeURIComponent(params.token)}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName: signerName.trim(), signerRelation, signatureData: signature }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "İmza kaydedilemedi.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "İmza kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !contract) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream px-6 dark:bg-midnight">
        <div className="max-w-sm rounded-2xl border border-hairline bg-white p-8 text-center dark:border-white/10 dark:bg-midnight-card">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <p className="text-sm text-espresso dark:text-cream">{error}</p>
        </div>
      </main>
    );
  }

  if (!contract) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream dark:bg-midnight">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </main>
    );
  }

  const isSigned = contract.status === "SIGNED";

  return (
    <main className="min-h-screen bg-cream pb-16 dark:bg-midnight">
      <header className="border-b border-hairline bg-white/80 px-5 py-4 backdrop-blur-md dark:border-white/10 dark:bg-midnight/80">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5">
          <GlowLogo size="h-8 w-8" textSize="text-xs" innerClassName="bg-espresso dark:bg-midnight" />
          <div className="min-w-0">
            <p className={cn(spaceGrotesk.className, "truncate text-sm font-semibold text-espresso dark:text-cream")}>{contract.institutionName}</p>
            <p className="truncate text-[11px] text-espresso-muted dark:text-cream/40">Elektronik Sözleşme İmzalama</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 pt-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {isSigned && (
            <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Sözleşme imzalandı</p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/70">
                  {contract.signerName}
                  {contract.signedAt ? ` · ${new Date(contract.signedAt).toLocaleString("tr-TR")}` : ""}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-hairline bg-white p-6 dark:border-white/10 dark:bg-midnight-card">
            <div className="mb-4 flex items-start gap-2.5 border-b border-hairline pb-4 dark:border-white/10">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0">
                <h1 className="text-base font-bold text-espresso dark:text-cream">{contract.title}</h1>
                <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/40">
                  {contract.studentName}
                  {contract.totalAmount != null ? ` · ${formatTRY(contract.totalAmount)}` : ""}
                  {contract.installmentCount != null ? ` · ${contract.installmentCount} taksit` : ""}
                </p>
              </div>
            </div>

            <div className="max-h-[46vh] overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-espresso dark:text-cream/90">
              {contract.content}
            </div>
          </div>

          {isSigned ? (
            <div className="mt-4 rounded-2xl border border-hairline bg-white p-6 dark:border-white/10 dark:bg-midnight-card">
              <p className="mb-2 text-xs font-medium text-espresso-muted dark:text-cream/40">İMZA</p>
              {contract.signatureData && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={contract.signatureData} alt="İmza" className="h-24 rounded-lg border border-hairline bg-white object-contain p-2 dark:border-white/10" />
              )}
              <p className="mt-2 text-sm font-semibold text-espresso dark:text-cream">{contract.signerName}</p>
              {contract.signerRelation && <p className="text-xs text-espresso-muted dark:text-cream/40">{contract.signerRelation}</p>}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-hairline bg-white p-6 dark:border-white/10 dark:bg-midnight-card">
              <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Elektronik İmza
              </p>

              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Ad Soyad</label>
                  <input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Adınız Soyadınız"
                    className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Yakınlık</label>
                  <select
                    value={signerRelation}
                    onChange={(e) => setSignerRelation(e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
                  >
                    {["Veli", "Anne", "Baba", "Vasi", "Diğer"].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <SignaturePad onChange={setSignature} disabled={saving} />

              <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-xs text-espresso dark:text-cream/80">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
                />
                <span>Sözleşmeyi okudum, anladım ve içeriğini kabul ediyorum.</span>
              </label>

              {error && <p className="mt-3 text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}

              <button
                onClick={handleSign}
                disabled={saving || !accepted || !signature || !signerName.trim()}
                className="mt-4 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Sözleşmeyi İmzala
              </button>
              <p className="mt-2 text-center text-[10px] text-espresso-muted dark:text-cream/40">
                İmzaladığınızda tarih, saat ve bağlantı bilgileriniz kayıt altına alınır.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
