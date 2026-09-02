"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Send, Loader2, CheckCircle2, Database } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { XrayAssignmentTargetPicker, type AssignmentTarget, type RosterForTargeting } from "@/components/xray/xray-assignment-target-picker";
import { useToast } from "@/lib/toast-context";

type Topic = { subtopicId: string; name: string; questionCount: number };

// Kullanıcı geri bildirimi — diğer 3 sekmede (Genel Konu/Alt Konu, bkz.
// XrayTestPickerModal) "Test Seç ve Ata" arama ekranı vardı, "Ne Kadar
// Anlamış" sekmesinde tutarsız şekilde eski, dar bir <select>+"Ata" satırı
// kalmıştı. Bu, AYNI arama deneyimini "Ne Kadar Anlamış" (kilitli test,
// /api/xray/comprehension-*) uçları için sağlar — XrayTestPickerModal'ın
// aksine konu havuzunda grade/topicName/kazanimCount bilgisi YOK (bkz.
// /api/xray/comprehension-topics), o yüzden sınıf filtresi göstermiyor.
export function XrayComprehensionPickerModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  branchId,
  branchName,
  grade,
  subject,
  roster,
  assignedSubtopicIds,
  onAssigned,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  branchId: string;
  branchName: string;
  grade: number;
  subject: string;
  roster: RosterForTargeting[];
  assignedSubtopicIds: Set<string>;
  onAssigned: () => void;
}) {
  const { showError, showToast } = useToast();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<AssignmentTarget>({ type: "student", studentId });
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setTarget({ type: "student", studentId });
    setTopics(null);
    fetch(`/api/xray/comprehension-topics?subject=${encodeURIComponent(subject)}`)
      .then((res) => res.json())
      .then((data) => setTopics(data.subtopics ?? []))
      .catch(() => showError("Konu listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, subject, studentId]);

  const filtered = useMemo(() => {
    if (!topics) return [];
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return topics;
    return topics.filter((t) => t.name.toLocaleLowerCase("tr-TR").includes(q));
  }, [topics, search]);

  async function assign(topic: Topic) {
    setAssigningId(topic.subtopicId);
    try {
      const res = await fetch("/api/xray/comprehension-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, subtopicId: topic.subtopicId, target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Atanamadı.");
      showToast("success", data.created > 1 ? `Test ${data.created} öğrenciye atandı.` : "Test atandı — öğrencinin panelinde görünecek.");
      onAssigned();
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Atanamadı.");
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Test Seç ve Ata" variant="center" widthClassName="max-w-2xl">
      <div className="space-y-3">
        <XrayAssignmentTargetPicker
          studentId={studentId}
          studentName={studentName}
          branchId={branchId}
          branchName={branchName}
          grade={grade}
          roster={roster}
          value={target}
          onChange={setTarget}
        />

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Konu ara..."
            className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>

        {topics === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl bg-cream-card px-4 py-10 text-center text-xs text-espresso-muted dark:bg-white/5 dark:text-cream/40">
            {topics.length === 0 ? "Bu ders için soru havuzunda henüz içerik yok." : "Eşleşen konu bulunamadı."}
          </p>
        ) : (
          <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
            {filtered.map((t) => {
              const isAssigned = assignedSubtopicIds.has(t.subtopicId);
              const isAssigning = assigningId === t.subtopicId;
              return (
                <button
                  key={t.subtopicId}
                  onClick={() => assign(t)}
                  disabled={assigningId !== null}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-hairline bg-white/60 px-3 py-2.5 text-left transition hover:border-sky-500/40 disabled:opacity-60 dark:border-white/10 dark:bg-midnight-card/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-espresso dark:text-cream">{t.name}</span>
                      {isAssigned && (
                        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Daha önce atandı
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-[10px] text-espresso-muted dark:text-cream/40">
                    <span className="flex items-center gap-1 font-mono">
                      <Database className="h-3 w-3" /> {t.questionCount}
                    </span>
                    {isAssigning ? <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" /> : <Send className="h-3.5 w-3.5 text-sky-600" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
