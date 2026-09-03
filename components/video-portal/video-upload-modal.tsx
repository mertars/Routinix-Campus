"use client";

import { useMemo, useState } from "react";
import { Clapperboard, Link2, CheckCircle2, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { extractYoutubeId, youtubeThumbnailUrl } from "@/lib/client/youtube";
import { VIDEO_SUBJECTS } from "@/lib/video-subjects";
import type { VideoLesson } from "@/components/video-portal/video-portal-panel";

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

// "Video Ekle" — YouTube tabanlı sürüm (bkz. prisma/schema.prisma > Video
// modelinin üstündeki gerekçe). Yönetici videoyu YouTube'a (gizli/liste
// dışı) kendisi yükler, buraya sadece linki yapıştırır — video ID'si
// otomatik çözülür ve canlı thumbnail önizlemesi gösterilir.
export function VideoUploadModal({
  isOpen,
  onClose,
  onAdded,
  videos,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (video: VideoLesson) => void;
  videos: VideoLesson[];
}) {
  const { showError } = useToast();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [grade, setGrade] = useState(9);
  const [subject, setSubject] = useState<string>(VIDEO_SUBJECTS[0]);
  const [topic, setTopic] = useState("");
  const [saving, setSaving] = useState(false);

  const videoId = useMemo(() => extractYoutubeId(url), [url]);
  const canSave = Boolean(videoId) && title.trim().length > 0 && topic.trim().length > 0 && !saving;

  // Kullanıcı geri bildirimi (2026-09-03) — bu öneriler eskiden panelin
  // "Tümü" filtresine bakıyordu (hep boştu). Artık modalın KENDİ seçili
  // sınıf/ders'ine göre CANLI hesaplanıyor + büyük/küçük harf farkı olan
  // aynı konu tekrar ETMİYOR (bkz. video-portal-panel.tsx'teki AYNI
  // normalizeTopicKey ilkesi).
  const existingTopics = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of videos) {
      if (v.grade !== grade || v.subject !== subject) continue;
      const key = v.topic.trim().toLocaleLowerCase("tr-TR");
      if (!seen.has(key)) seen.set(key, v.topic.trim());
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, "tr-TR"));
  }, [videos, grade, subject]);

  function reset() {
    setUrl("");
    setTitle("");
    setDescription("");
    setGrade(9);
    setSubject(VIDEO_SUBJECTS[0]);
    setTopic("");
  }

  async function handleSave() {
    if (!videoId || !canSave) return;
    setSaving(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          grade,
          subject,
          topic: topic.trim(),
          youtubeId: videoId,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onAdded(data.video);
      reset();
      onClose();
    } catch {
      showError("Video eklenemedi. Lütfen tekrar dene.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (saving) return;
        reset();
        onClose();
      }}
      title="Video Ekle"
      variant="center"
      widthClassName="max-w-lg"
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">YouTube Linki</label>
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={saving}
              placeholder="https://youtu.be/..."
              className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-sm text-espresso outline-none focus:border-violet-500 disabled:opacity-60 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
          </div>
        </div>

        {url.trim().length > 0 && (
          <div className={videoId ? "overflow-hidden rounded-xl border border-emerald-500/30" : "flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2.5"}>
            {videoId ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- dış (YouTube) kaynaklı, next/image domain izni gerektirmeyen basit önizleme */}
                <img src={youtubeThumbnailUrl(videoId)} alt="" className="aspect-video w-full object-cover" />
                <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                  <CheckCircle2 className="h-3 w-3" /> Video bulundu
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-rose-700 dark:text-rose-300">Geçerli bir YouTube linki tanınamadı.</p>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Video Başlığı</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            placeholder="Örn. Türev — Zincir Kuralı Anlatımı"
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
            list="video-topic-suggestions"
            placeholder="Örn. Türev"
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-violet-500 disabled:opacity-60 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
          <datalist id="video-topic-suggestions">
            {existingTopics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Açıklama (isteğe bağlı)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
            rows={2}
            placeholder="Öğrencinin videoyu izlemeden önce göreceği kısa not..."
            className="w-full resize-none rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-violet-500 disabled:opacity-60 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
          {saving ? "Kaydediliyor..." : "Kütüphaneye Ekle"}
        </button>
      </div>
    </Modal>
  );
}
