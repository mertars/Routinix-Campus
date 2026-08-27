"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Phone, Lock, ArrowRight, Loader2, ShieldAlert, Building2 } from "lucide-react";
import { AuroraOrbs, GlowLogo, spaceGrotesk, AURORA_GRID_STYLE } from "@/components/ui/aurora-brand";
import { cn } from "@/lib/utils";

// Kurum panellerinin giriş ekranından (app/login) BİLEREK ayrı, çok daha
// basit bir sayfa — burada rol seçimi/OTP akışı yok, sadece telefon+şifre
// (bkz. app/api/platform/login). Platform sahibi hesabı, self-servis kayıt
// OLMADAN scripts/create-platform-owner.ts ile bootstrap edilir.
const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder-white/25 outline-none transition-all duration-200 focus:bg-white/[0.08] focus:ring-2 focus:border-white/40 focus:ring-white/20";

export default function PlatformLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/platform/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Giriş başarısız.");
      router.push("/platform");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08060B] p-4">
      <AuroraOrbs />
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={AURORA_GRID_STYLE} />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <GlowLogo size="h-9 w-9" textSize="text-sm" />
          <div>
            <span className={cn(spaceGrotesk.className, "block text-base font-semibold text-white")}>Routinix Kampüs</span>
            <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-white/40">
              <Building2 className="h-3 w-3" /> Platform Yönetimi
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-white/10 via-white/5 to-transparent opacity-60 blur-2xl" aria-hidden />
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <h1 className={cn(spaceGrotesk.className, "text-2xl font-bold text-white")}>Süper Admin Girişi</h1>
            <p className="mt-1.5 mb-6 text-sm text-white/40">Yeni kurum açmak ve mevcut kurumları görmek için giriş yapın.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-white/70">
                  <Phone className="h-3.5 w-3.5" /> Telefon Numarası
                </span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0555 000 00 00"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-white/70">
                  <Lock className="h-3.5 w-3.5" /> Şifre
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </label>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-300"
                >
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={loading || !phone.trim() || !password.trim()}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-espresso transition hover:bg-white/90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
