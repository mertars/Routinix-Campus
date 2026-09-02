"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock, Check, Flag, History } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type RawAssignment = {
  id: string;
  variant?: "genel" | "alt_konu" | "yerlestirme";
  subtopicName: string;
  status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "FLAGGED";
  assignedAt: string;
  completedAt: string | null;
};

type HistoryRow = { id: string; typeLabel: string; typeTone: string; subtopicName: string; status: RawAssignment["status"]; assignedAt: string };

const TYPE_META: Record<string, { label: string; tone: string }> = {
  yerlestirme: { label: "Seviye Belirleme", tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  genel: { label: "Genel Konu", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  alt_konu: { label: "Alt Konu", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  yeterlilik: { label: "Ne Kadar Anlamış", tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
};

const STATUS_META: Record<RawAssignment["status"], { label: string; icon: typeof Clock; className: string }> = {
  ASSIGNED: { label: "Bekliyor", icon: Clock, className: "bg-cream-muted text-espresso-muted dark:bg-white/10 dark:text-cream/40" },
  IN_PROGRESS: { label: "Devam Ediyor", icon: Clock, className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  COMPLETED: { label: "Tamamlandı", icon: Check, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  FLAGGED: { label: "İhlal", icon: Flag, className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};

// Kullanıcı geri bildirimi (2026-09-03) — "öğrenciye atılan eski testler
// yöneticinin ekranında gözükmeli": 4 test tipi (Seviye Belirleme/Genel
// Konu/Alt Konu ayrı ayrı sekmelerde, Ne Kadar Anlamış ayrı bir sistemde)
// dağınık duruyordu, tek bir kronolojik özet YOKTU. Bu, ÖĞRENCİ BAŞLIĞINDA
// eskiden ortalama yüzdesinin durduğu yere (bkz. xray-results-panel.tsx —
// ortalama zaten aşağıdaki "Ortalama" istatistik kartında ayrıca
// görünüyor, burada TEKRAR göstermeye gerek yoktu) eklenen yuvarlak
// "Geçmiş" tuşuyla açılır. Yeni bir backend ucu GEREKMEDİ — practice-
// assignments'ın `variant` parametresi VERİLMEZSE zaten Seviye Belirleme+
// Genel Konu+Alt Konu'nun ÜÇÜNÜ birden döner (bkz. route'un kendi yorumu).
export function XrayTestHistoryModal({ isOpen, onClose, studentId, studentName }: { isOpen: boolean; onClose: () => void; studentId: string; studentName: string }) {
  const { showError } = useToast();
  const [rows, setRows] = useState<HistoryRow[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRows(null);
    Promise.all([
      fetch(`/api/xray/practice-assignments?studentId=${encodeURIComponent(studentId)}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error()))),
      fetch(`/api/xray/comprehension-assignments?studentId=${encodeURIComponent(studentId)}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error()))),
    ])
      .then(([practice, comprehension]) => {
        const practiceRows: HistoryRow[] = (practice.assignments ?? []).map((a: RawAssignment) => {
          const meta = TYPE_META[a.variant ?? "genel"];
          return { id: a.id, typeLabel: meta.label, typeTone: meta.tone, subtopicName: a.subtopicName, status: a.status, assignedAt: a.assignedAt };
        });
        const comprehensionRows: HistoryRow[] = (comprehension.assignments ?? []).map((a: RawAssignment) => ({
          id: a.id,
          typeLabel: TYPE_META.yeterlilik.label,
          typeTone: TYPE_META.yeterlilik.tone,
          subtopicName: a.subtopicName,
          status: a.status,
          assignedAt: a.assignedAt,
        }));
        setRows([...practiceRows, ...comprehensionRows].sort((a, b) => (a.assignedAt < b.assignedAt ? 1 : -1)));
      })
      .catch(() => showError("Test geçmişi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, studentId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${studentName} — Test Geçmişi`} variant="center" widthClassName="max-w-2xl">
      {!rows ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
        </div>
      ) : rows.length === 0 ? (
        <p className="flex flex-col items-center gap-2 rounded-2xl bg-cream-card px-4 py-10 text-center text-xs text-espresso-muted dark:bg-white/5 dark:text-cream/40">
          <History className="h-5 w-5" /> Bu öğrenciye henüz hiç test atanmamış.
        </p>
      ) : (
        <div className="max-h-[65vh] space-y-1.5 overflow-y-auto pr-1">
          {rows.map((r) => {
            const meta = STATUS_META[r.status];
            const Icon = meta.icon;
            return (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
                <div className="min-w-0">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-semibold", r.typeTone)}>{r.typeLabel}</span>
                    <span className="truncate text-xs font-medium text-espresso dark:text-cream">{r.subtopicName}</span>
                  </div>
                  <p className="text-[10px] text-espresso-muted dark:text-cream/40">{new Date(r.assignedAt).toLocaleDateString("tr-TR")}</p>
                </div>
                <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.className)}>
                  <Icon className="h-3 w-3" /> {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
