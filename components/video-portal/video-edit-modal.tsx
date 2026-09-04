"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { VIDEO_SUBJECTS } from "@/lib/video-subjects";
import type { VideoLesson } from "@/components/video-portal/video-portal-panel";

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

// Denetim bulgusu (2026-09-05) — yükleme sonrası tek CRUD eylemi silmekti;
// bir yazım hatasını düzeltmek ya da yanlış sınıfa/derse yüklenmiş bir
// videoyu taşımak için TÜM dosyayı silip yeniden yüklemek (yeniden YouTube
// kotası harcamak) gerekiyordu. Bu modal SADECE metadata'yı (video
// dosyasının/YouTube kaydının kendisine dokunmadan) düzenler — bkz.
// PATCH /api/videos/[id].
export function VideoEditModal({
  video,
  onClose,
  onUpdated,
}: {
  video: VideoLesson | null;
  onClose: () => void;
  onUpdated: (video: VideoLesson) => void;
}) {
  const { showError } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [grade, setGrade] = useState(9);
  const [subject, setSubject] = useState<string>(VIDEO_SUBJECTS[0]);
  const [topic, setTopic] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!video) return;
    setTitle(video.title);
    setDescription(video.description ?? "");
    setGrade(video.grade);
    setSubject(video.subject);
    setTopic(video.topic);
  }, [video]);

  if (!video) return null;
  const canSave = title.trim().length > 0 && topic.trim().length > 0 && !saving;

  async function handleSave() {
    if (!video || !canSave) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(video.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, grade, subject, topic: topic.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Video güncellenemedi.");
      onUpdated(data.video);
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Video güncellenemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={Boolean(video)} onClose={onClose} title="Videoyu Düzenle" variant="center" widthClassName="max-w-lg">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Video Başlığı</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-violet-500 disabled:opacity-60 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Sınıf</label>
            <select
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
              disabled={saving}
              className="w-full rounded-lg border border-hairline bg-white px-2.5 py-2 text-sm text-espresso outline-none focus:border-violet-500 disabled:opacity-60 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}. Sınıf
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Ders</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-hairline bg-white px-2.5 py-2 text-sm text-espresso outline-none focus:border-violet-500 disabled:opacity-60 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            >
              {VIDEO_SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Konu</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-violet-500 disabled:opacity-60 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Açıklama (isteğe bağlı)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
            rows={2}
            className="w-full resize-none rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-violet-500 disabled:opacity-60 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Kaydet
        </button>
      </div>
    </Modal>
  );
}
