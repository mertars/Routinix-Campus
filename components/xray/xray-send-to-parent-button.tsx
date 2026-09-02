"use client";

import { useEffect, useState } from "react";
import { Send, MessageCircle, Loader2, ChevronDown } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { fetchAndDownloadPdf } from "@/lib/client/download-pdf";
import { buildWhatsappLink } from "@/lib/client/whatsapp";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";

type Target = { key: string; label: string; phone: string };

// Kullanıcı geri bildirimi (2026-09-03) — SMS seçeneği kaldırıldı: "smsten
// pdf atmayacağımız için kalkmalı" (SMS zaten sadece metin bildirimi
// gönderiyordu, PDF hiç taşımıyordu — kafa karıştırıcı bulundu). Yerine
// WhatsApp hedefi olarak ÖĞRENCİ de eklendi (eskiden SADECE veli vardı).
//
// WhatsApp'ın kendisi bir web sitesinden dosya eki OTOMATİK göndermeyi
// SAĞLAMIYOR (wa.me linki SADECE metin ön-doldurur — platform kısıtı,
// bkz. lib/client/whatsapp.ts). Kullanıcı onayıyla (2026-09-03) seçilen
// yol: doğru numaraya ADRESLİ bir WhatsApp sohbeti aç + PDF'i AYNI ANDA
// indir — son "sohbete sürükleyip ekleme" adımı manuel kalır. window.open
// senkron (await'ten ÖNCE) çağrılıyor — aksi halde popup engelleyici
// kullanıcı etkileşim penceresi kapandığı için sessizce engeller (bkz.
// lib/client/download-pdf.ts'teki AYNI uyarı).
export function XraySendToParentButton({ studentId, studentName, subject }: { studentId: string; studentName: string; subject: string }) {
  const { showError, showToast } = useToast();
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [sendingKey, setSendingKey] = useState<string | null>(null);

  useEffect(() => {
    setTargets(null);
    fetch(`/api/xray/send-targets/${encodeURIComponent(studentId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => {
        const list: Target[] = [];
        if (data.studentPhone) list.push({ key: "student", label: `${data.studentName ?? studentName} (Öğrenci)`, phone: data.studentPhone });
        for (const p of data.parents ?? []) {
          if (p.phone) list.push({ key: p.id, label: `${p.name} (${p.relationshipLabel})`, phone: p.phone });
        }
        setTargets(list);
      })
      .catch(() => setTargets([]));
  }, [studentId, studentName]);

  async function sendTo(target: Target) {
    setSendingKey(target.key);
    const waLink = buildWhatsappLink(
      target.phone,
      `Sayın ${target.label.replace(/\s*\(.*\)$/, "")}, ${studentName} için Akademik Röntgen raporu hazır. Az önce indirdiğim PDF'i bu sohbete ekliyorum.`
    );
    const win = window.open(waLink, "_blank", "noopener,noreferrer");
    try {
      await fetchAndDownloadPdf(
        `/api/xray/report/${encodeURIComponent(studentId)}?subject=${encodeURIComponent(subject)}`,
        undefined,
        `${studentName}-rontgen-raporu.pdf`.replace(/\s+/g, "-")
      );
      showToast("info", "PDF indirildi — açılan WhatsApp sohbetine sürükleyip ekleyebilirsiniz.");
    } catch (error) {
      win?.close();
      showError(error instanceof Error ? error.message : "Rapor oluşturulamadı.");
    } finally {
      setSendingKey(null);
    }
  }

  return (
    <DropdownMenu
      trigger={
        <button className="flex h-9 items-center gap-1.5 rounded-full border border-sky-500/25 bg-sky-500/10 px-3.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-500/20 dark:text-sky-300">
          <Send className="h-3.5 w-3.5" /> Veliye Gönder <ChevronDown className="h-3 w-3" />
        </button>
      }
    >
      {targets === null ? (
        <div className="flex items-center justify-center px-3.5 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
        </div>
      ) : targets.length === 0 ? (
        <p className="px-3.5 py-2.5 text-[12px] text-espresso-muted dark:text-cream/40">Kayıtlı telefon bulunamadı.</p>
      ) : (
        targets.map((t) => (
          <DropdownMenuItem
            key={t.key}
            icon={sendingKey === t.key ? Loader2 : MessageCircle}
            label={t.label}
            onClick={() => sendTo(t)}
            disabled={sendingKey !== null}
            spinning={sendingKey === t.key}
            iconClassName="text-emerald-500"
          />
        ))
      )}
    </DropdownMenu>
  );
}
