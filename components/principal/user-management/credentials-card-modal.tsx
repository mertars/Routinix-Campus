"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { KeyRound, User, Copy, Check, Send, Loader2, ShieldAlert, BadgeCheck } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { SuccessConfetti } from "./success-confetti";

export type NewUserCredentials = { name: string; username: string; password: string; phone?: string; institutionalCode?: string };

export function CredentialsCardModal({ credentials, onClose }: { credentials: NewUserCredentials | null; onClose: () => void }) {
  const { showError, showSuccess } = useToast();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<"username" | "password" | null>(null);
  const [smsState, setSmsState] = useState<"idle" | "sending" | "sent">("idle");
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    if (!credentials) return;
    setShowConfetti(true);
    setSmsState("idle");
    const payload = [
      "Routinix Kampüs Giriş",
      `Kullanıcı Adı: ${credentials.username}`,
      `Şifre: ${credentials.password}`,
      credentials.institutionalCode ? `Kurumsal Kod: ${credentials.institutionalCode}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    QRCode.toDataURL(payload, { margin: 1, width: 220, color: { dark: "#2C221E", light: "#FDFBF7" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
    const timer = setTimeout(() => setShowConfetti(false), 1300);
    return () => clearTimeout(timer);
  }, [credentials]);

  async function copy(field: "username" | "password", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      showError("Panoya kopyalanamadı.");
    }
  }

  async function sendSms() {
    if (!credentials?.phone) return;
    setSmsState("sending");
    try {
      const res = await fetch("/api/admin/send-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: credentials.phone, name: credentials.name, username: credentials.username, password: credentials.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "SMS gönderilemedi.");
      setSmsState("sent");
      showSuccess("Giriş bilgileri SMS ile gönderildi.");
    } catch (error) {
      setSmsState("idle");
      showError(error instanceof Error ? error.message : "SMS gönderilemedi.");
    }
  }

  return (
    <Modal isOpen={!!credentials} onClose={onClose} title="Giriş Kartı" variant="center">
      {credentials && (
        <div className="relative">
          {showConfetti && <SuccessConfetti />}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 text-center">
            <p className="text-sm font-semibold text-espresso dark:text-cream">{credentials.name}</p>
            <p className="text-xs text-espresso-muted dark:text-cream/40">Hesap başarıyla oluşturuldu</p>
          </motion.div>

          <div className="mb-4 flex justify-center">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Giriş QR kodu" className="h-40 w-40 rounded-2xl border border-hairline dark:border-white/10" />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-2xl bg-cream-card text-xs text-espresso-muted dark:bg-white/5 dark:text-cream/40">
                QR oluşturuluyor...
              </div>
            )}
          </div>

          {credentials.institutionalCode && (
            <div className="mb-2 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 dark:bg-brand-600/10">
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-600" />
              <span className="text-xs text-espresso dark:text-cream">
                <span className="text-espresso-muted dark:text-cream/40">Kurumsal Kod: </span>
                <span className="font-mono font-semibold">{credentials.institutionalCode}</span>
              </span>
            </div>
          )}

          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
            <span className="flex min-w-0 items-center gap-2 text-xs text-espresso dark:text-cream">
              <User className="h-3.5 w-3.5 shrink-0 text-brand-600" />
              <span className="min-w-0 truncate">
                <span className="text-espresso-muted dark:text-cream/40">Kullanıcı Adı: </span>
                <span className="font-mono font-semibold">{credentials.username}</span>
              </span>
            </span>
            <button onClick={() => copy("username", credentials.username)} className="shrink-0 text-espresso-muted hover:text-brand-600 dark:text-cream/40">
              {copied === "username" ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
            <span className="flex min-w-0 items-center gap-2 text-xs text-espresso dark:text-cream">
              <KeyRound className="h-3.5 w-3.5 shrink-0 text-brand-600" />
              <span className="min-w-0 truncate">
                <span className="text-espresso-muted dark:text-cream/40">Geçici Şifre: </span>
                <span className="font-mono font-semibold">{credentials.password}</span>
              </span>
            </span>
            <button onClick={() => copy("password", credentials.password)} className="shrink-0 text-espresso-muted hover:text-brand-600 dark:text-cream/40">
              {copied === "password" ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="mb-3 flex items-start gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-[10px] text-brand-700 dark:bg-brand-600/10 dark:text-brand-300">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Bu şifre sadece bir kez gösterilir, kapattıktan sonra tekrar görüntülenemez.
          </div>

          <button
            onClick={sendSms}
            disabled={!credentials.phone || smsState !== "idle"}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            {smsState === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {smsState === "sent" ? "SMS Gönderildi" : smsState === "sending" ? "Gönderiliyor..." : credentials.phone ? "SMS ile Gönder" : "Telefon numarası girilmedi"}
          </button>
        </div>
      )}
    </Modal>
  );
}
