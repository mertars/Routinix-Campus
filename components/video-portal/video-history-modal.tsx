"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, History, CheckCircle2, Clock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { subjectTone } from "@/lib/video-subjects";
import { cn } from "@/lib/utils";

type HistoryRow = {
  id: string;
  assignedAt: string;
  watchedAt: string | null;
  watchedPercent: number | null;
  videoId: string;
  videoTitle: string;
  videoSubject: string;
  videoTopic: string;
  videoGrade: number;
  studentId: string;
  studentName: string;
  branchName: string;
};

// Kullanıcı talebi (2026-09-04) — "video geçmişi paneli de lazım, kime
// önceden ne atıldı görebilmeli". Video Ders Merkezi'nin kendi üst
// çubuğundaki "Geçmiş" tuşundan açılır, KURUMUN TÜM atama geçmişini
// (öğrenci adı VEYA video başlığına göre aranabilir) listeler — izlenip
// izlenmediği de görünür (bkz. VideoAssignment.watchedAt, ilk izlemede
// bir kez set edilir, bkz. app/api/videos/assigned/[id]/watched).
export function VideoHistoryModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { showError } = useToast();
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    if (rows) return;
    fetch("/api/videos/assignment-history")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setRows(data.history ?? []))
      .catch(() => showError("Atama geçmişi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return rows;
    return rows.filter((r) => `${r.studentName} ${r.videoTitle} ${r.branchName}`.toLocaleLowerCase("tr-TR").includes(q));
  }, [rows, query]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Video Atama Geçmişi" variant="center" widthClassName="max-w-2xl">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Öğrenci, video veya şube ara..."
            className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-sm text-espresso outline-none focus:border-violet-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>

        {!rows ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="flex flex-col items-center gap-2 rounded-2xl bg-cream-card px-4 py-10 text-center text-xs text-espresso-muted dark:bg-white/5 dark:text-cream/40">
            <History className="h-5 w-5" /> {rows.length === 0 ? "Henüz hiç video atanmamış." : "Eşleşen kayıt bulunamadı."}
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
            {filtered.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-espresso dark:text-cream">
                    {r.studentName} <span className="font-normal text-espresso-muted dark:text-cream/40">· {r.branchName}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10.5px] text-espresso-muted dark:text-cream/40">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", subjectTone(r.videoSubject).dot)} />
                    {r.videoTitle}
                  </p>
                  <p className="mt-0.5 text-[10px] text-espresso-muted/70 dark:text-cream/30">{new Date(r.assignedAt).toLocaleDateString("tr-TR")} tarihinde atandı</p>
                </div>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    r.watchedAt
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-cream-muted text-espresso-muted dark:bg-white/10 dark:text-cream/40"
                  )}
                >
                  {r.watchedAt ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> {r.watchedPercent !== null ? `İzlendi · %${r.watchedPercent}` : "İzlendi"}
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3" /> İzlenmedi
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
