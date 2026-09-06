"use client";

import { useEffect, useState } from "react";
import { Share2, MessageCircle, Loader2, BellRing } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { fetchAndDownloadPdf } from "@/lib/client/download-pdf";
import { buildWhatsappLink } from "@/lib/client/whatsapp";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";

type Target = { key: string; label: string; phone: string };

// Deneme karnesi paylaşım menüsü — bkz. xray-send-to-parent-button.tsx
// AYNI WhatsApp deseni (wa.me SADECE metin ön-doldurur, PDF ayrıca
// indirilir — platform kısıtı). Buradaki fark: öğrenci VE veli hedefleri
// ayrı satır, ARTI bir de "Panele Bildir" seçeneği — bu, karneyi panele
// GÖNDERMEZ (sonuç zaten kaydedilir kaydedilmez otomatik görünür, bkz.
// öğrenci tarafı net-tracker.tsx), sadece bir duyuru (Announcement)
// oluşturup "sonucun hazır" bildirimini panele düşürür.
export function ExamKarneShareButton({ examId, studentId, studentName }: { examId: string; studentId: string; studentName: string }) {
  const { showError, showToast, showSuccess } = useToast();
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    setTargets(null);
    fetch(`/api/exams/send-targets/${encodeURIComponent(studentId)}`)
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

  async function sendWhatsapp(target: Target) {
    setBusyKey(target.key);
    const waLink = buildWhatsappLink(
      target.phone,
      `Sayın ${target.label.replace(/\s*\(.*\)$/, "")}, ${studentName} için deneme karnesi hazır. Az önce indirdiğim PDF'i bu sohbete ekliyorum.`
    );
    const win = window.open(waLink, "_blank", "noopener,noreferrer");
    try {
      await fetchAndDownloadPdf(`/api/exams/${examId}/karne/${studentId}`, undefined, `${studentName}-karne.pdf`.replace(/\s+/g, "-"));
      showToast("info", "PDF indirildi — açılan WhatsApp sohbetine sürükleyip ekleyebilirsiniz.");
    } catch (error) {
      win?.close();
      showError(error instanceof Error ? error.message : "Karne oluşturulamadı.");
    } finally {
      setBusyKey(null);
    }
  }

  async function notifyPanel() {
    setBusyKey("notify");
    try {
      const res = await fetch(`/api/exams/${examId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [studentId] }),
      });
      if (!res.ok) throw new Error();
      showSuccess(`${studentName} — öğrenci ve veli paneline bildirim düştü.`);
    } catch {
      showError("Bildirilemedi.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <DropdownMenu
      trigger={
        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-espresso-muted transition hover:bg-cream-card hover:text-espresso dark:text-cream/40 dark:hover:bg-white/10 dark:hover:text-cream">
          <Share2 className="h-3.5 w-3.5" />
        </button>
      }
    >
      {targets === null ? (
        <div className="flex items-center justify-center px-3.5 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          {targets.length === 0 ? (
            <p className="px-3.5 py-2.5 text-[12px] text-espresso-muted dark:text-cream/40">Kayıtlı telefon bulunamadı.</p>
          ) : (
            targets.map((t) => (
              <DropdownMenuItem
                key={t.key}
                icon={busyKey === t.key ? Loader2 : MessageCircle}
                label={`WhatsApp — ${t.label}`}
                onClick={() => sendWhatsapp(t)}
                disabled={busyKey !== null}
                spinning={busyKey === t.key}
                iconClassName="text-emerald-500"
              />
            ))
          )}
          <DropdownMenuItem
            icon={busyKey === "notify" ? Loader2 : BellRing}
            label="Öğrenci + Veli Paneline Bildir"
            onClick={notifyPanel}
            disabled={busyKey !== null}
            spinning={busyKey === "notify"}
            iconClassName="text-sky-500"
          />
        </>
      )}
    </DropdownMenu>
  );
}
