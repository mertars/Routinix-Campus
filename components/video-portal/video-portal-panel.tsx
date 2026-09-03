"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Send, PlayCircle, Clapperboard, Loader2, Trash2 } from "lucide-react";
import { VIDEO_SUBJECTS, subjectTone } from "@/lib/video-subjects";
import { useToast } from "@/lib/toast-context";
import { VideoUploadModal } from "@/components/video-portal/video-upload-modal";
import { VideoAssignModal } from "@/components/video-portal/video-assign-modal";
import { VideoPreviewModal } from "@/components/video-portal/video-preview-modal";
import { cn } from "@/lib/utils";

export type VideoLesson = {
  id: string;
  title: string;
  description?: string | null;
  url: string;
  grade: number;
  subject: string;
  topic: string;
  durationSeconds: number | null;
  createdAt: string;
};

// Video Ders Merkezi — R2 tabanlı gerçek sürüm (kullanıcı kararı,
// 2026-09-03: "herşeyi kur, r2yi bağla"). Kütüphane artık /api/videos'tan
// geliyor, "Video Ekle" gerçekten R2'ye yükleyip DB'ye kaydediyor, "Ata"
// gerçekten VideoAssignment satırları oluşturuyor — hiçbiri mock DEĞİL.
// Gruplama üç katmanlı (kullanıcı isteği): Sınıf (chip) → Ders (chip) →
// Konu (bölüm başlığı) → video kartları.
export function VideoPortalPanel({ canManage }: { canManage: boolean }) {
  const { showError, showToast } = useToast();
  const [videos, setVideos] = useState<VideoLesson[] | null>(null);
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<number | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<VideoLesson | null>(null);
  const [assignVideo, setAssignVideo] = useState<VideoLesson | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function loadVideos() {
    return fetch("/api/videos")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setVideos(data.videos ?? []))
      .catch(() => showError("Video kütüphanesi yüklenemedi."));
  }

  useEffect(() => {
    loadVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableGrades = useMemo(() => [...new Set((videos ?? []).map((v) => v.grade))].sort((a, b) => a - b), [videos]);
  const availableSubjects = useMemo(() => VIDEO_SUBJECTS.filter((s) => (videos ?? []).some((v) => v.subject === s)), [videos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return (videos ?? []).filter((v) => {
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

  const existingTopics = useMemo(
    () => [...new Set((videos ?? []).filter((v) => v.grade === gradeFilter && v.subject === subjectFilter).map((v) => v.topic))],
    [videos, gradeFilter, subjectFilter]
  );

  async function handleDelete(video: VideoLesson) {
    if (!confirm(`"${video.title}" videosunu silmek istediğine emin misin? Bu işlem geri alınamaz.`)) return;
    setDeletingId(video.id);
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(video.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setVideos((prev) => (prev ?? []).filter((v) => v.id !== video.id));
      showToast("success", "Video silindi.");
    } catch {
      showError("Video silinemedi.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-espresso dark:text-cream">
            <Clapperboard className="h-5 w-5 text-violet-600 dark:text-violet-400" /> Video Ders Merkezi
          </h1>
          <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/40">{videos?.length ?? 0} video · sınıf, ders ve konuya göre gruplanmış</p>
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

      {videos === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
        </div>
      ) : groupedByTopic.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline bg-white/40 py-16 text-center dark:border-white/10 dark:bg-white/5">
          <Clapperboard className="h-6 w-6 text-espresso-muted dark:text-cream/30" />
          <p className="text-xs text-espresso-muted dark:text-cream/40">{videos.length === 0 ? "Henüz video eklenmedi." : "Eşleşen video bulunamadı."}</p>
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
                  <VideoCard
                    key={video.id}
                    video={video}
                    index={index}
                    canManage={canManage}
                    deleting={deletingId === video.id}
                    onPreview={() => setPreviewVideo(video)}
                    onAssign={() => setAssignVideo(video)}
                    onDelete={() => handleDelete(video)}
                  />
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
          onAdded={(video) => {
            setVideos((prev) => [video, ...(prev ?? [])]);
          }}
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
  deleting,
  onPreview,
  onAssign,
  onDelete,
}: {
  video: VideoLesson;
  index: number;
  canManage: boolean;
  deleting: boolean;
  onPreview: () => void;
  onAssign: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.03 }}
      className="group overflow-hidden rounded-2xl border border-hairline bg-white/70 shadow-sm backdrop-blur-sm transition hover:border-violet-400/40 hover:shadow-md dark:border-white/10 dark:bg-midnight-card/50"
    >
      <button onClick={onPreview} className="group/thumb relative block aspect-video w-full overflow-hidden bg-espresso dark:bg-black">
        <video src={video.url} className="h-full w-full object-cover" preload="metadata" muted />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover/thumb:bg-black/40">
          <PlayCircle className="h-9 w-9 text-white drop-shadow-lg" />
        </div>
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">{video.grade}. Sınıf</span>
      </button>
      <div className="p-3">
        <p className="line-clamp-2 text-xs font-semibold text-espresso dark:text-cream">{video.title}</p>
        <p className="mt-1 text-[10.5px] text-espresso-muted dark:text-cream/40">{video.subject}</p>
        {canManage && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <button
              onClick={onAssign}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet-500/10 py-1.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-500/20 dark:text-violet-300"
            >
              <Send className="h-3 w-3" /> Ata
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              aria-label="Videoyu sil"
              className="flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 transition hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-400"
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
