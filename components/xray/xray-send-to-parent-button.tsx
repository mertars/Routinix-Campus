"use client";

import { useState } from "react";
import { Bell, Share2, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { fetchAndSharePdf } from "@/lib/client/download-pdf";
import { cn } from "@/lib/utils";

type SmsState = "idle" | "sending" | "sent" | "no-recipient" | "failed";

// Faz Q — kullanıcı talebi: "tek tuşla veliye atabilecek... whatsapptan
// atma ve veli paneline yollama". İki AYRI, birbirinden bağımsız kanal:
// SMS otomatik gider (xray-assignment-tracking-dashboard.tsx'teki
// RemindButton'la BİREBİR AYNI /api/notifications/send deseni), WhatsApp
// ise gerçek bir API entegrasyonu GEREKTİRMEZ — fetchAndSharePdf (Web
// Share API) zaten xray-results-panel.tsx'teki "Paylaş" butonunda
// kullanılan AYNI mekanizma, native paylaşım sayfası WhatsApp'ı da
// listeler (yüklüyse). Veli paneli ayrıca hiçbir eylem GEREKTİRMEZ — veli
// zaten kendi çocuğunun verisine portalinden erişebiliyor (bkz.
// xray-summary-card.tsx'e eklenen XrayPlacementProgressCard).
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

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={sendSms}
        disabled={smsState === "sending" || smsState === "sent"}
        title={smsState === "no-recipient" ? "Bu veli SMS onayı vermemiş" : "Veliye SMS gönder"}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm transition disabled:opacity-70",
          smsState === "sent" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          smsState === "no-recipient" && "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
          smsState === "failed" && "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
          (smsState === "idle" || smsState === "sending") && "border-sky-500/25 bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 dark:text-sky-300"
        )}
      >
        {smsState === "sending" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : smsState === "sent" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : smsState === "no-recipient" || smsState === "failed" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
      </button>
      <button
        onClick={shareWhatsapp}
        disabled={sharing}
        title="WhatsApp'ta paylaş"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-500/25 bg-sky-500/10 text-sky-600 transition hover:bg-sky-500/20 disabled:opacity-60 dark:text-sky-300"
      >
        {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
