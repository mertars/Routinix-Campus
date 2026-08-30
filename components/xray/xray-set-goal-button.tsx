"use client";

import { useEffect, useState } from "react";
import { Target, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";

type Topic = { subtopicId: string; subtopicName: string };

// Faz P — Pomodoro'daki hedef kartlarının Akademik Röntgen uyarlaması:
// öğrencinin kendi Xray sekmesindeki (xray-goals-card.tsx) AYNI POST
// ucunu kullanır, sadece öğretmen/yönetici tarafında öğrenci EXPLICIT
// seçiliyor. Kullanıcının "öğrenci/veli/öğretmenin BİRLİKTE koyduğu
// hedef" isteği — veli SADECE görüntüler (mevcut veli rolü zaten genelde
// salt-okunur), bu buton öğretmen/yönetici içindir.
export function XraySetGoalButton({ studentId, studentName, subject }: { studentId: string; studentName: string; subject: string }) {
  const { showError, showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subtopicId, setSubtopicId] = useState("");
  const [targetScore, setTargetScore] = useState(80);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/xray/practice-tests?subject=${encodeURIComponent(subject)}`)
      .then((res) => res.json())
      .then((data) => {
        setTopics(data.topics ?? []);
        setSubtopicId((current) => current || data.topics?.[0]?.subtopicId || "");
      })
      .catch(() => {});
  }, [open, subject]);

  async function submit() {
    if (!subtopicId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/xray/mastery-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, subject, subtopicId, targetScore }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Hedef eklenemedi.");
      showToast("success", `${studentName} için hedef kaydedildi.`);
      setOpen(false);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Hedef eklenemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-500/25 bg-brand-500/10 text-brand-600 transition hover:bg-brand-500/20 dark:text-brand-300"
        aria-label="Hedef belirle"
      >
        <Target className="h-4 w-4" />
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title={`${studentName} için Hedef Belirle`} variant="center" widthClassName="max-w-sm">
        <div className="space-y-3">
          <select
            value={subtopicId}
            onChange={(event) => setSubtopicId(event.target.value)}
            disabled={topics.length === 0}
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            {topics.length === 0 && <option value="">Bu ders için havuzda içerik yok</option>}
            {topics.map((t) => (
              <option key={t.subtopicId} value={t.subtopicId}>
                {t.subtopicName}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={targetScore}
              onChange={(event) => setTargetScore(Number(event.target.value))}
              className="flex-1 accent-brand-600"
            />
            <span className="w-12 shrink-0 text-right text-sm font-bold text-espresso dark:text-cream">%{targetScore}</span>
          </div>
          <button
            onClick={submit}
            disabled={saving || !subtopicId}
            className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
            Hedefi Kaydet
          </button>
        </div>
      </Modal>
    </>
  );
}
