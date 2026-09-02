"use client";

import { useState } from "react";
import { Send, Bell, Share2, Loader2, AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { fetchAndSharePdf } from "@/lib/client/download-pdf";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SmsState = "idle" | "sending" | "sent" | "no-recipient" | "failed";

// Faz Q — kullanıcı talebi: "tek tuşla veliye atabilecek... whatsapptan
// atma ve veli paneline yollama". İki AYRI, birbirinden bağımsız kanal:
// SMS otomatik gider (xray-assignment-tracking-dashboard.tsx'teki
// RemindButton'la BİREBİR AYNI /api/notifications/send deseni), WhatsApp
// ise gerçek bir API entegrasyonu GEREKTİRMEZ — fetchAndSharePdf (Web
// Share API) zaten xray-results-panel.tsx'teki "Paylaş" butonunda
// kullanılan AYNI mekanizma. Veli paneli ayrıca hiçbir eylem GEREKTİRMEZ.
//
// Faz "menü düzenlemesi" — eskiden 2 ayrı ikon-buton yan yanaydı, artık
// TEK "Veliye Gönder" tetikleyicisi altında iki menü satırı (SMS/WhatsApp'ın
// KENDİ fonksiyon mantığı DEĞİŞMEDİ, sadece dış görünüm).
export function XraySendToParentButton({ studentId, studentName, subject }: { studentId: string; studentName: string; subject: string }) {
  const { showError } = useToast();
  const [smsState, setSmsState] = useState<SmsState>("idle");
  const [sharing, setSharing] = useState(false);

  async function sendSms() {
    setSmsState("sending");
    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeType: "CUSTOM_ID_LIST",
          scopeValue: studentId,
          templateBody: "Sayın {veli_adi}, {ogrenci_adi} için Akademik Röntgen seviye belirleme sonucu hazır. Detaylar için veli panelinizi ziyaret edebilirsiniz.",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data?.error === "string" && data.error.includes("SMS onayı")) {
          setSmsState("no-recipient");
          return;
        }
        throw new Error(data?.error ?? "Gönderilemedi.");
      }
      setSmsState(data.recipientCount > 0 ? "sent" : "no-recipient");
    } catch {
      setSmsState("failed");
    }
  }

  async function shareWhatsapp() {
    setSharing(true);
    try {
      await fetchAndSharePdf(
        `/api/xray/report/${encodeURIComponent(studentId)}?subject=${encodeURIComponent(subject)}`,
        undefined,
        `${studentName}-rontgen-raporu.pdf`.replace(/\s+/g, "-"),
        `${studentName} — Akademik Röntgen Raporu`
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "Rapor oluşturulamadı.");
    } finally {
      setSharing(false);
    }
  }

  const smsLabel =
    smsState === "sent" ? "SMS gönderildi" : smsState === "no-recipient" ? "SMS onayı yok" : smsState === "failed" ? "Tekrar dene" : "SMS Gönder";
  const SmsIcon = smsState === "sending" ? Loader2 : smsState === "sent" ? CheckCircle2 : smsState === "no-recipient" || smsState === "failed" ? AlertTriangle : Bell;

  return (
    <DropdownMenu
      trigger={
        <button className="flex h-9 items-center gap-1.5 rounded-full border border-sky-500/25 bg-sky-500/10 px-3.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-500/20 dark:text-sky-300">
          <Send className="h-3.5 w-3.5" /> Veliye Gönder <ChevronDown className="h-3 w-3" />
        </button>
      }
    >
      <button
        onClick={sendSms}
        disabled={smsState === "sending" || smsState === "sent"}
        className={cn(
          "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium transition disabled:opacity-70",
          smsState === "no-recipient" || smsState === "failed" ? "text-amber-700 dark:text-amber-400" : "text-espresso hover:bg-cream-card dark:text-cream dark:hover:bg-white/5"
        )}
      >
        <SmsIcon className={cn("h-4 w-4 shrink-0", smsState === "sending" && "animate-spin")} />
        <span className="min-w-0 flex-1 truncate">{smsLabel}</span>
      </button>
      <DropdownMenuItem icon={sharing ? Loader2 : Share2} label="WhatsApp'ta Paylaş" onClick={shareWhatsapp} disabled={sharing} spinning={sharing} />
    </DropdownMenu>
  );
}
