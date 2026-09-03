"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Send, PlayCircle, Clapperboard } from "lucide-react";
import { VIDEO_SUBJECTS, subjectTone } from "@/lib/video-subjects";
import { youtubeThumbnailUrl } from "@/lib/client/youtube";
import { VideoUploadModal } from "@/components/video-portal/video-upload-modal";
import { VideoAssignModal } from "@/components/video-portal/video-assign-modal";
import { VideoPreviewModal } from "@/components/video-portal/video-preview-modal";
import { cn } from "@/lib/utils";

export type VideoLesson = {
  id: string;
  title: string;
  description?: string;
  youtubeId: string;
  grade: number;
  subject: string;
  topic: string;
  addedAt: string;
};

const SEED_VIDEOS: VideoLesson[] = [
  { id: "v1", title: "Türev — Zincir Kuralı Anlatımı", youtubeId: "jNQXAC9IVRw", grade: 12, subject: "Matematik", topic: "Türev", addedAt: "2026-08-20T10:00:00.000Z" },
  { id: "v2", title: "Türev — Fonksiyonun Grafiği Üzerinden Yorumlama", youtubeId: "jNQXAC9IVRw", grade: 12, subject: "Matematik", topic: "Türev", addedAt: "2026-08-22T10:00:00.000Z" },
  { id: "v3", title: "İntegral — Belirsiz İntegral Temelleri", youtubeId: "jNQXAC9IVRw", grade: 12, subject: "Matematik", topic: "İntegral", addedAt: "2026-08-18T10:00:00.000Z" },
  { id: "v4", title: "Newton'un Hareket Yasaları", youtubeId: "jNQXAC9IVRw", grade: 9, subject: "Fizik", topic: "Kuvvet ve Hareket", addedAt: "2026-08-15T10:00:00.000Z" },
  { id: "v5", title: "Mol Kavramı ve Kimyasal Hesaplamalar", youtubeId: "jNQXAC9IVRw", grade: 10, subject: "Kimya", topic: "Mol Kavramı", addedAt: "2026-08-25T10:00:00.000Z" },
  { id: "v6", title: "Hücre Zarından Madde Geçişi", youtubeId: "jNQXAC9IVRw", grade: 9, subject: "Biyoloji", topic: "Hücre", addedAt: "2026-08-19T10:00:00.000Z" },
  { id: "v7", title: "Osmanlı Kuruluş Dönemi Özeti", youtubeId: "jNQXAC9IVRw", grade: 10, subject: "Tarih", topic: "Osmanlı Kuruluş Dönemi", addedAt: "2026-08-21T10:00:00.000Z" },
];

// Video Ders Merkezi — TASARIM AŞAMASI (kullanıcı: "şimdilik bunu dizayn
// et, gelişmeleri devamında yaparız"). Veri bellekte (useState, seed'lenmiş
// örnek videolarla) — henüz bir Video Prisma modeli/API'si YOK, bilerek.
// Gruplama üç katmanlı: Sınıf (chip) → Ders (chip) → Konu (bölüm başlığı)
// — kullanıcının "kaçıncı sınıf hangi ders hangi konu" isteğiyle birebir
// eşleşiyor. "Ata" akışı gerçek öğrenci listesini çeker ama kayıt henüz
// kalıcı değil (bkz. video-assign-modal.tsx).
export function VideoPortalPanel({ canManage }: { canManage: boolean }) {
  const [videos, setVideos] = useState<VideoLesson[]>(SEED_VIDEOS);
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<number | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<VideoLesson | null>(null);
  const [assignVideo, setAssignVideo] = useState<VideoLesson | null>(null);

  const availableGrades = useMemo(() => [...new Set(videos.map((v) => v.grade))].sort((a, b) => a - b), [videos]);
  const availableSubjects = useMemo(() => VIDEO_SUBJECTS.filter((s) => videos.some((v) => v.subject === s)), [videos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return videos.filter((v) => {
      if (gradeFilter !== null && v.grade !== gradeFilter) return false;
      if (subjectFilter !== null && v.subject !== subjectFilter) return false;
      if (q && !`${v.title} ${v.topic}`.toLocaleLowerCase("tr-TR").includes(q)) return false;
      return true;
    });
  }, [videos, gradeFilter, subjectFilter, query]);

  const groupedByTopic = useMemo(() => {
    const map = new Map<string, VideoLesson[]>();
    for (const v of filtered) {
      const list = map.get(v.topic) ?? [];
      list.push(v);
      map.set(v.topic, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr-TR"));
  }, [filtered]);

  const existingTopics = useMemo(() => [...new Set(videos.filter((v) => v.grade === gradeFilter && v.subject === subjectFilter).map((v) => v.topic))], [videos, gradeFilter, subjectFilter]);

  function addVideo(video: Omit<VideoLesson, "id" | "addedAt">) {
    setVideos((prev) => [{ ...video, id: `v${Date.now()}`, addedAt: new Date().toISOString() }, ...prev]);
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-espresso dark:text-cream">
            <Clapperboard className="h-5 w-5 text-violet-600 dark:text-violet-400" /> Video Ders Merkezi
          </h1>
          <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/40">{videos.length} video · sınıf, ders ve konuya göre gruplanmış</p>
        </div>
        {canManage && (
          <button
            onClick={() => setUploadOpen(true)}
            className="flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" /> Video Ekle
          </button>
        )}
      </div>

      <div className="mb-4 space-y-2.5">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Video veya konu ara..."
            className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-sm text-espresso outline-none focus:border-violet-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10.5px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Sınıf</span>
          <FilterChip label="Tümü" active={gradeFilter === null} onClick={() => setGradeFilter(null)} />
          {availableGrades.map((g) => (
            <FilterChip key={g} label={`${g}. Sınıf`} active={gradeFilter === g} onClick={() => setGradeFilter(g)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10.5px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Ders</span>
          <FilterChip label="Tümü" active={subjectFilter === null} onClick={() => setSubjectFilter(null)} />
          {availableSubjects.map((s) => (
            <FilterChip key={s} label={s} active={subjectFilter === s} onClick={() => setSubjectFilter(s)} tone={subjectTone(s)} />
          ))}
        </div>
      </div>

      {groupedByTopic.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline bg-white/40 py-16 text-center dark:border-white/10 dark:bg-white/5">
          <Clapperboard className="h-6 w-6 text-espresso-muted dark:text-cream/30" />
          <p className="text-xs text-espresso-muted dark:text-cream/40">Eşleşen video bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByTopic.map(([topic, topicVideos]) => (
            <div key={topic}>
              <h2 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
                <span className={cn("h-1.5 w-1.5 rounded-full", subjectTone(topicVideos[0].subject).dot)} />
                {topic}
                <span className="text-[10px] font-normal text-espresso-muted dark:text-cream/40">({topicVideos.length})</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {topicVideos.map((video, index) => (
                  <VideoCard key={video.id} video={video} index={index} canManage={canManage} onPreview={() => setPreviewVideo(video)} onAssign={() => setAssignVideo(video)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <VideoUploadModal
          isOpen={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onAdd={addVideo}
          existingTopics={existingTopics}
        />
      )}
      <VideoPreviewModal
        video={previewVideo}
        onClose={() => setPreviewVideo(null)}
        onAssign={(video) => {
          setPreviewVideo(null);
          setAssignVideo(video);
        }}
      />
      <VideoAssignModal isOpen={assignVideo !== null} onClose={() => setAssignVideo(null)} video={assignVideo} />
    </div>
  );
}

function FilterChip({ label, active, onClick, tone }: { label: string; active: boolean; onClick: () => void; tone?: { text: string; bg: string } }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
        active
          ? tone
            ? cn("border-transparent", tone.bg, tone.text)
            : "border-violet-500 bg-violet-500/10 text-violet-700 dark:border-violet-400/60 dark:text-violet-300"
          : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
      )}
    >
      {label}
    </button>
  );
}

function VideoCard({
  video,
  index,
  canManage,
  onPreview,
  onAssign,
}: {
  video: VideoLesson;
  index: number;
  canManage: boolean;
  onPreview: () => void;
  onAssign: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.03 }}
      className="group overflow-hidden rounded-2xl border border-hairline bg-white/70 shadow-sm backdrop-blur-sm transition hover:border-violet-400/40 hover:shadow-md dark:border-white/10 dark:bg-midnight-card/50"
    >
      <button onClick={onPreview} className="relative block aspect-video w-full overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element -- dış (YouTube) kaynaklı thumbnail */}
        <img src={youtubeThumbnailUrl(video.youtubeId)} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
          <PlayCircle className="h-9 w-9 text-white opacity-0 drop-shadow-lg transition group-hover:opacity-100" />
        </div>
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">{video.grade}. Sınıf</span>
      </button>
      <div className="p-3">
        <p className="line-clamp-2 text-xs font-semibold text-espresso dark:text-cream">{video.title}</p>
        <p className="mt-1 text-[10.5px] text-espresso-muted dark:text-cream/40">{video.subject}</p>
        {canManage && (
          <button
            onClick={onAssign}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-500/10 py-1.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-500/20 dark:text-violet-300"
          >
            <Send className="h-3 w-3" /> Öğrenciye Ata
          </button>
        )}
      </div>
    </motion.div>
  );
}
