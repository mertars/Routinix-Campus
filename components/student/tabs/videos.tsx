"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clapperboard, PlayCircle, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { YoutubePlayer } from "@/components/video-portal/youtube-player";
import { youtubeThumbnailUrl } from "@/lib/client/youtube";
import { subjectTone } from "@/lib/video-subjects";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type AssignedVideo = {
  assignmentId: string;
  id: string;
  title: string;
  description: string | null;
  grade: number;
  subject: string;
  topic: string;
  youtubeId: string | null;
  status: "PROCESSING" | "READY" | "FAILED";
  assignedAt: string;
  watchedAt: string | null;
  lastPositionSeconds: number | null;
  durationSeconds: number | null;
};

// Video Ders Merkezi — öğrenci tarafı ("Video Derslerim"). Yöneticinin
// kütüphanesinden (/videos/principal) atanan videolar burada çıkar — bkz.
// /api/videos/assigned (SADECE bu öğrenciye atananlar, tüm kütüphane
// DEĞİL). "İzlendi" işareti artık GERÇEK oynatma olayında konuyor (bkz.
// youtube-player.tsx > onFirstPlay — IFrame Player API'nin postMessage
// tabanlı olay dinleyicisi), sadece modalı açmakla DEĞİL.
export function VideoLibraryTab() {
  const { showError } = useToast();
  const [videos, setVideos] = useState<AssignedVideo[] | null>(null);
  const [active, setActive] = useState<AssignedVideo | null>(null);

  function loadVideos() {
    return fetch("/api/videos/assigned")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setVideos(data.assignments ?? []))
      .catch(() => showError("Videolar yüklenemedi."));
  }

  useEffect(() => {
    loadVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Denetim bulgusu (2026-09-05) — yönetici paneli PROCESSING videoları
  // periyodik tazeliyordu (bkz. video-portal-panel.tsx), öğrenci tarafı
  // TEK seferlik fetch yapıyordu: bir video izlenirken/atanmışken hazır
  // hale gelse bile öğrenci sayfayı yenilemeden bunu göremiyordu. Aynı
  // "sadece işleniyor varken tazele, hiçbiri kalmayınca kendiliğinden dur"
  // deseni burada da uygulanıyor.
  useEffect(() => {
    if (!videos?.some((v) => v.status === "PROCESSING")) return;
    const timer = setInterval(loadVideos, 6000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos]);

  const grouped = useMemo(() => {
    const map = new Map<string, AssignedVideo[]>();
    for (const v of videos ?? []) {
      const list = map.get(v.subject) ?? [];
      list.push(v);
      map.set(v.subject, list);
    }
    return [...map.entries()];
  }, [videos]);

  async function markWatched(video: AssignedVideo, durationSeconds: number) {
    if (video.watchedAt) return;
    try {
      await fetch(`/api/videos/assigned/${encodeURIComponent(video.assignmentId)}/watched`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds }),
      });
      setVideos((prev) => (prev ?? []).map((v) => (v.assignmentId === video.assignmentId ? { ...v, watchedAt: new Date().toISOString() } : v)));
    } catch {
      // sessizce yut — izlenme işareti önemsiz bir UX detayı, kritik değil
    }
  }

  // "Kaldığı yerden devam" (2026-09-05) — oynatıcı periyodik (~10sn) ve
  // duraklat/bitir anında çağırır; sessizce yutuluyor (izlemeyi asla
  // ENGELLEMEMESİ gerekiyor, bkz. progress endpoint'inin kendi yorumu).
  function reportProgress(assignmentId: string, positionSeconds: number) {
    fetch(`/api/videos/assigned/${encodeURIComponent(assignmentId)}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionSeconds }),
    }).catch(() => {});
  }

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50"
      >
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Clapperboard className="h-4 w-4 text-violet-600 dark:text-violet-400" /> Video Derslerim
        </h2>

        {videos === null ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
          </div>
        ) : videos.length === 0 ? (
          <p className="rounded-2xl bg-cream-card px-4 py-8 text-center text-xs text-espresso-muted dark:bg-white/5 dark:text-cream/40">
            Henüz sana atanmış bir video yok.
          </p>
        ) : (
          <div className="space-y-5">
            {grouped.map(([subject, subjectVideos]) => {
              const tone = subjectTone(subject);
              return (
                <div key={subject}>
                  <p className={cn("mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide", tone.text)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} /> {subject}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {subjectVideos.map((video) => {
                      const notReady = video.status !== "READY";
                      return (
                      <button
                        key={video.assignmentId}
                        onClick={() => {
                          if (notReady) return;
                          setActive(video);
                        }}
                        disabled={notReady}
                        className={cn(
                          "group overflow-hidden rounded-2xl border border-hairline bg-white/60 text-left shadow-sm transition hover:border-violet-400/40 hover:shadow-md dark:border-white/10 dark:bg-midnight-card/40",
                          notReady && "cursor-wait"
                        )}
                      >
                        <div className="relative aspect-video w-full overflow-hidden bg-espresso dark:bg-black">
                          {video.youtubeId && (
                            // eslint-disable-next-line @next/next/no-img-element -- dış (YouTube) kaynaklı thumbnail
                            <img src={youtubeThumbnailUrl(video.youtubeId)} alt="" className={cn("h-full w-full object-cover", notReady && "opacity-40")} />
                          )}
                          {video.status === "PROCESSING" && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50">
                              <Loader2 className="h-5 w-5 animate-spin text-white" />
                              <span className="text-[9.5px] font-semibold text-white">Hazırlanıyor...</span>
                            </div>
                          )}
                          {video.status === "FAILED" && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-rose-950/60">
                              <AlertTriangle className="h-5 w-5 text-rose-300" />
                            </div>
                          )}
                          {!notReady && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/40">
                              <PlayCircle className="h-8 w-8 text-white drop-shadow-lg" />
                            </div>
                          )}
                          {video.watchedAt && (
                            <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[9.5px] font-semibold text-white">
                              <CheckCircle2 className="h-2.5 w-2.5" /> İzlendi
                            </span>
                          )}
                          {/* Kaldığı yerden devam göstergesi — videonun neredeyse
                              tamamı izlenmişse (son %5) artık anlamsız, gösterilmiyor. */}
                          {video.lastPositionSeconds && video.durationSeconds && video.lastPositionSeconds < video.durationSeconds * 0.95 && (
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                              <div
                                className="h-full bg-violet-400"
                                style={{ width: `${Math.min(100, (video.lastPositionSeconds / video.durationSeconds) * 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="line-clamp-2 text-[11px] font-semibold text-espresso dark:text-cream">{video.title}</p>
                          <p className="mt-0.5 text-[10px] text-espresso-muted dark:text-cream/40">{video.topic}</p>
                        </div>
                      </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {active && active.youtubeId && (
        <Modal isOpen={Boolean(active)} onClose={() => setActive(null)} title={active.title} variant="center" widthClassName="max-w-2xl">
          <div className="space-y-3">
            <YoutubePlayer
              videoId={active.youtubeId}
              initialPositionSeconds={active.lastPositionSeconds ?? undefined}
              onFirstPlay={(durationSeconds) => markWatched(active, durationSeconds)}
              onProgress={(seconds) => reportProgress(active.assignmentId, seconds)}
            />
            {active.description && <p className="text-xs leading-relaxed text-espresso-muted dark:text-cream/50">{active.description}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
