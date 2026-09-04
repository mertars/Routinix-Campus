"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Send,
  PlayCircle,
  Clapperboard,
  Loader2,
  Trash2,
  ChevronRight,
  ChevronLeft,
  FolderOpen,
  AlertTriangle,
  Target,
  History,
  CheckCircle2,
} from "lucide-react";
import { VIDEO_SUBJECTS, subjectTone } from "@/lib/video-subjects";
import { youtubeThumbnailUrl } from "@/lib/client/youtube";
import { useToast } from "@/lib/toast-context";
import { VideoUploadModal } from "@/components/video-portal/video-upload-modal";
import { VideoAssignModal } from "@/components/video-portal/video-assign-modal";
import { VideoPreviewModal } from "@/components/video-portal/video-preview-modal";
import { VideoHistoryModal } from "@/components/video-portal/video-history-modal";
import { cn } from "@/lib/utils";

export type VideoLesson = {
  id: string;
  title: string;
  description?: string | null;
  youtubeId: string;
  status: "PROCESSING" | "READY" | "FAILED";
  grade: number;
  subject: string;
  topic: string;
  createdAt: string;
};

function normalizeTopicKey(topic: string): string {
  return topic.trim().toLocaleLowerCase("tr-TR");
}

// Röntgen entegrasyonu (2026-09-04) — kullanıcı talebi: öneri tek tek
// videoyu açmadan DOĞRUDAN panelde görünmeli VE "ata" dendiğinde hangi
// videonun gideceği NET olmalı. /api/videos/recommendations-overview her
// satırda TEK bir öğrenci + TEK bir video döndürür (bkz. o dosyadaki
// gerekçe — kurum geneli TEK sorgu turu, kart başına ayrı istek YOK),
// böylece "Ata" tek tıkla, hangi videonun gittiği belirsizlik olmadan
// çalışabiliyor.
type RecommendationPair = {
  studentId: string;
  studentName: string;
  branchName: string;
  grade: number;
  subtopicName: string;
  masteryScore: number;
  videoId: string;
  videoTitle: string;
  videoSubject: string;
  videoTopic: string;
};

// Video Ders Merkezi — YouTube tabanlı sürüm (bkz. prisma/schema.prisma >
// Video modelinin üstündeki gerekçe — R2 denendi, yavaş/tutarsız çıktı).
// Kullanıcı talebi (2026-09-04) — "menü tasarımı berbat, kalıpların dışına
// çık": klasik sabit sidebar filtre listesi TAMAMEN kaldırıldı, yerine
// Drive/Finder esintili "klasör kartları" geldi — her DERS büyük renkli bir
// klasör kartı, tıklayınca içine giriliyor (bkz. FolderCard + openSubject
// state'i), içeride sınıf seviyesi bir çip şeridiyle daraltılıyor. Konu
// grupları büyük/küçük harfe DUYARSIZ (normalize edilmiş anahtar) —
// "türev" ile "Türev" tek grupta birleşiyor.
export function VideoPortalPanel({ canManage }: { canManage: boolean }) {
  const { showError, showToast } = useToast();
  const [videos, setVideos] = useState<VideoLesson[] | null>(null);
  const [query, setQuery] = useState("");
  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<VideoLesson | null>(null);
  const [assignVideo, setAssignVideo] = useState<VideoLesson | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [recommendationPairs, setRecommendationPairs] = useState<RecommendationPair[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!canManage) return;
    fetch("/api/videos/recommendations-overview")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setRecommendationPairs(data.pairs ?? []))
      .catch(() => setRecommendationPairs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleQuickAssign(pair: RecommendationPair) {
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(pair.videoId)}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [pair.studentId] }),
      });
      if (!res.ok) throw new Error();
      setRecommendationPairs((prev) => (prev ?? []).filter((p) => p.studentId !== pair.studentId));
      showToast("success", `"${pair.videoTitle}" ${pair.studentName} adlı öğrenciye atandı.`);
    } catch {
      showError("Atama yapılamadı.");
    }
  }

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

  // Kullanıcı geri bildirimi (2026-09-04) — YouTube video baytlarını
  // ALMASI ile videonun GERÇEKTEN oynatılabilir olması ayrı şeyler; hâlâ
  // "işleniyor" olan video varken kütüphaneyi birkaç saniyede bir tazeler
  // (GET /api/videos zaten YouTube'dan durumu kontrol edip günceliyor,
  // bkz. route.ts) — hiçbiri işlenmeden kalmayınca kendiliğinden durur.
  useEffect(() => {
    if (!videos?.some((v) => v.status === "PROCESSING")) return;
    const timer = setInterval(loadVideos, 6000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos]);

  // Klasör kartları — her ders için video listesi + sınıf dağılımı
  // (kartın altındaki mini çubuk grafiğe besleniyor).
  const subjectFolders = useMemo(() => {
    const map = new Map<string, VideoLesson[]>();
    for (const v of videos ?? []) {
      if (!map.has(v.subject)) map.set(v.subject, []);
      map.get(v.subject)!.push(v);
    }
    return VIDEO_SUBJECTS.filter((s) => map.has(s)).map((subject) => {
      const subjectVideos = map.get(subject)!;
      const gradeCounts = [...new Set(subjectVideos.map((v) => v.grade))]
        .sort((a, b) => a - b)
        .map((grade) => ({ grade, count: subjectVideos.filter((v) => v.grade === grade).length }));
      return { subject, count: subjectVideos.length, gradeCounts };
    });
  }, [videos]);

  const scopeVideos = useMemo(() => (openSubject ? (videos ?? []).filter((v) => v.subject === openSubject) : (videos ?? [])), [videos, openSubject]);
  const subjectGrades = useMemo(() => [...new Set(scopeVideos.map((v) => v.grade))].sort((a, b) => a - b), [scopeVideos]);

  const browsing = openSubject !== null || query.trim() !== "";

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return scopeVideos.filter((v) => {
      if (openSubject && gradeFilter !== null && v.grade !== gradeFilter) return false;
      if (q && !`${v.title} ${v.topic}`.toLocaleLowerCase("tr-TR").includes(q)) return false;
      return true;
    });
  }, [scopeVideos, gradeFilter, query, openSubject]);

  const groupedByTopic = useMemo(() => {
    const map = new Map<string, { label: string; videos: VideoLesson[] }>();
    for (const v of filtered) {
      const key = normalizeTopicKey(v.topic);
      const entry = map.get(key) ?? { label: v.topic.trim(), videos: [] };
      entry.videos.push(v);
      map.set(key, entry);
    }
    return [...map.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, "tr-TR"));
  }, [filtered]);

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
    <div className="mx-auto max-w-[1800px] px-4 py-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-espresso dark:text-cream">
            <Clapperboard className="h-5 w-5 text-violet-600 dark:text-violet-400" /> Video Ders Merkezi
          </h1>
          <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/40">{videos?.length ?? 0} video · sınıf, ders ve konuya göre gruplanmış</p>
        </div>

        {/* Arama, Röntgen Önerileri ve Geçmiş/Ekle tuşları TEK sırada,
            sağda — kullanıcı talebi: "röntgen kısmını arama çubuğuyla
            video ekleme tuşunun arasına koyalım". Öneri ve geçmiş sadece
            atama yapabilen (canManage) rolde anlamlı, o yüzden aynı şart. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={openSubject ? `${openSubject} içinde ara...` : "Video veya konu ara..."}
              className="w-48 rounded-xl border border-hairline bg-white py-2.5 pl-9 pr-3 text-sm text-espresso outline-none focus:w-64 focus:border-violet-500 sm:w-56 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
          </div>
          {canManage && <RecommendationsMenu pairs={recommendationPairs} onAssign={handleQuickAssign} />}
          {canManage && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-hairline px-3 text-xs font-semibold text-espresso-muted transition hover:bg-cream-card hover:text-espresso dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5 dark:hover:text-cream"
            >
              <History className="h-3.5 w-3.5" /> Geçmiş
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setUploadOpen(true)}
              className="flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" /> Video Ekle
            </button>
          )}
        </div>
      </div>

      {videos === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
        </div>
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline bg-white/40 py-16 text-center dark:border-white/10 dark:bg-white/5">
          <Clapperboard className="h-6 w-6 text-espresso-muted dark:text-cream/30" />
          <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz video eklenmedi.</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {!browsing ? (
            // KLASÖR GÖRÜNÜMÜ — her ders, Drive/Finder esintili bir klasör
            // kartı; tıklayınca "içine giriliyor" (bkz. FolderCard altı).
            <motion.div
              key="folders"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4"
            >
              {subjectFolders.map((folder, index) => (
                <FolderCard key={folder.subject} folder={folder} index={index} onOpen={() => setOpenSubject(folder.subject)} />
              ))}
            </motion.div>
          ) : (
            <motion.div key="contents" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              {/* Ekmek kırıntısı + (yalnızca bir ders açıkken) sınıf çipleri */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    setOpenSubject(null);
                    setGradeFilter(null);
                  }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-espresso-muted transition hover:bg-cream-card hover:text-espresso dark:text-cream/50 dark:hover:bg-white/5 dark:hover:text-cream"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Tüm Dersler
                </button>
                {openSubject && (
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", subjectTone(openSubject).bg, subjectTone(openSubject).text)}>
                    {openSubject}
                  </span>
                )}
                {openSubject && subjectGrades.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <GradeChip label="Tümü" active={gradeFilter === null} onClick={() => setGradeFilter(null)} />
                    {subjectGrades.map((g) => (
                      <GradeChip key={g} label={`${g}. Sınıf`} active={gradeFilter === g} onClick={() => setGradeFilter(g)} />
                    ))}
                  </div>
                )}
              </div>

              {groupedByTopic.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline bg-white/40 py-16 text-center dark:border-white/10 dark:bg-white/5">
                  <Clapperboard className="h-6 w-6 text-espresso-muted dark:text-cream/30" />
                  <p className="text-xs text-espresso-muted dark:text-cream/40">Eşleşen video bulunamadı.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {groupedByTopic.map(([key, group]) => (
                    <div key={key}>
                      <h2 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
                        <span className={cn("h-1.5 w-1.5 rounded-full", subjectTone(group.videos[0].subject).dot)} />
                        {group.label}
                        <span className="text-[10px] font-normal text-espresso-muted dark:text-cream/40">({group.videos.length})</span>
                      </h2>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {group.videos.map((video, index) => (
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
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {canManage && (
        <VideoUploadModal
          isOpen={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onAdded={(video) => {
            setVideos((prev) => [video, ...(prev ?? [])]);
          }}
          videos={videos ?? []}
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
      {canManage && <VideoHistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}

// Röntgen Önerileri — tetikleyici + açılır liste (bkz. dosya başındaki
// RecommendationPair notu). Her satır TEK bir öğrenci↔video eşleşmesi,
// "Ata" doğrudan tek tıkla atıyor — hangi videonun gideceği HER satırda
// açıkça yazıyor, VideoAssignModal'ı açmaya gerek yok.
function RecommendationsMenu({ pairs, onAssign }: { pairs: RecommendationPair[] | null; onAssign: (pair: RecommendationPair) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!pairs || pairs.length === 0) return null;

  async function handleAssign(pair: RecommendationPair) {
    setAssigningId(pair.studentId);
    await onAssign(pair);
    setAssigningId(null);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition",
          open
            ? "border-rose-400/50 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            : "border-rose-400/25 bg-rose-500/5 text-rose-700 hover:border-rose-400/50 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300"
        )}
      >
        <Target className="h-3.5 w-3.5" /> Röntgen Önerileri
        <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">{pairs.length}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="absolute right-0 top-full z-30 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-hairline bg-white shadow-2xl dark:border-white/10 dark:bg-midnight-card"
          >
            <p className="border-b border-hairline px-3.5 py-2.5 text-[11px] text-espresso-muted dark:border-white/10 dark:text-cream/40">
              Öğrencinin zayıf olduğu konuyla eşleşen video — tek tıkla atanır.
            </p>
            <div className="max-h-96 overflow-y-auto p-1.5">
              {pairs.map((pair) => (
                <div key={pair.studentId} className="flex items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-cream-card dark:hover:bg-white/5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-espresso dark:text-cream">
                      {pair.studentName} <span className="font-normal text-espresso-muted dark:text-cream/40">· {pair.branchName}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[10.5px] text-rose-700 dark:text-rose-300">
                      {pair.subtopicName} · %{pair.masteryScore}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[10.5px] text-espresso-muted dark:text-cream/40">
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", subjectTone(pair.videoSubject).dot)} />
                      {pair.videoTitle}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAssign(pair)}
                    disabled={assigningId === pair.studentId}
                    className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-2.5 text-[11px] font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                  >
                    {assigningId === pair.studentId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Ata
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Klasör kartı — Drive/Finder esintili: küçük bir "kulak" (tab) kartın sol
// üstünden dışarı taşıyor, gerçek bir klasörün silüetini taklit ediyor.
// Alttaki mini çubuk grafik, dersin sınıflara göre video dağılımını (kaç
// videosu hangi sınıfta) tek bakışta gösteriyor.
function FolderCard({
  folder,
  index,
  onOpen,
}: {
  folder: { subject: string; count: number; gradeCounts: { grade: number; count: number }[] };
  index: number;
  onOpen: () => void;
}) {
  const tone = subjectTone(folder.subject);
  const maxCount = Math.max(1, ...folder.gradeCounts.map((g) => g.count));

  return (
    <motion.button
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(index, 8) * 0.04, type: "spring", stiffness: 300, damping: 26 }}
      whileHover={{ y: -3 }}
      onClick={onOpen}
      className="group relative pt-2 text-left"
    >
      <div className={cn("absolute left-4 top-0 h-3 w-14 rounded-t-lg opacity-80 transition-opacity group-hover:opacity-100", tone.dot)} />
      <div
        className={cn(
          "relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-hairline p-4 shadow-sm backdrop-blur-sm transition-all group-hover:shadow-lg dark:border-white/10",
          tone.bg
        )}
      >
        <div className="flex items-start justify-between">
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm", tone.dot)}>
            <FolderOpen className="h-4.5 w-4.5" />
          </span>
          <ChevronRight className="h-4 w-4 text-espresso-muted/50 transition group-hover:translate-x-0.5 group-hover:text-espresso dark:text-cream/30 dark:group-hover:text-cream" />
        </div>

        <div>
          <p className={cn("truncate text-sm font-bold", tone.text)}>{folder.subject}</p>
          <p className="mt-0.5 text-[10.5px] text-espresso-muted dark:text-cream/40">{folder.count} video</p>
        </div>

        <div className="flex h-5 items-end gap-1">
          {folder.gradeCounts.map(({ grade, count }) => (
            <div
              key={grade}
              title={`${grade}. Sınıf · ${count} video`}
              className={cn("w-1.5 rounded-full opacity-70", tone.dot)}
              style={{ height: `${Math.max(25, (count / maxCount) * 100)}%` }}
            />
          ))}
        </div>
      </div>
    </motion.button>
  );
}

function GradeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
        active
          ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300"
          : "border-hairline text-espresso-muted hover:bg-cream-card hover:text-espresso dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5 dark:hover:text-cream"
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
  const notReady = video.status !== "READY";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.03 }}
      className="group overflow-hidden rounded-2xl border border-hairline bg-white/70 shadow-sm backdrop-blur-sm transition hover:border-violet-400/40 hover:shadow-md dark:border-white/10 dark:bg-midnight-card/50"
    >
      <button
        onClick={onPreview}
        disabled={notReady}
        className={cn("group/thumb relative block aspect-video w-full overflow-hidden bg-espresso dark:bg-black", notReady && "cursor-wait")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- dış (YouTube) kaynaklı thumbnail */}
        <img src={youtubeThumbnailUrl(video.youtubeId)} alt="" className={cn("h-full w-full object-cover", notReady && "opacity-40")} />
        {video.status === "PROCESSING" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/50">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
            <span className="text-[10px] font-semibold text-white">Yayına hazırlanıyor...</span>
          </div>
        )}
        {video.status === "FAILED" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-rose-950/60">
            <AlertTriangle className="h-6 w-6 text-rose-300" />
            <span className="text-[10px] font-semibold text-rose-200">Yükleme başarısız</span>
          </div>
        )}
        {!notReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover/thumb:bg-black/40">
            <PlayCircle className="h-9 w-9 text-white drop-shadow-lg" />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">{video.grade}. Sınıf</span>
      </button>
      <div className="p-3">
        <p className="line-clamp-2 text-xs font-semibold text-espresso dark:text-cream">{video.title}</p>
        <p className="mt-1 text-[10.5px] text-espresso-muted dark:text-cream/40">{video.subject}</p>
        {canManage && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <button
              onClick={onAssign}
              disabled={notReady}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet-500/10 py-1.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-500/20 disabled:cursor-wait disabled:opacity-40 dark:text-violet-300"
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
