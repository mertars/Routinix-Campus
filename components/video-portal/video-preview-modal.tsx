"use client";

import { Send, GraduationCap, BookOpen, Layers } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { YoutubePlayer } from "@/components/video-portal/youtube-player";
import { subjectTone } from "@/lib/video-subjects";
import { cn } from "@/lib/utils";
import type { VideoLesson } from "@/components/video-portal/video-portal-panel";

export function VideoPreviewModal({ video, onClose, onAssign }: { video: VideoLesson | null; onClose: () => void; onAssign: (video: VideoLesson) => void }) {
  if (!video) return null;
  const tone = subjectTone(video.subject);

  return (
    <Modal isOpen={Boolean(video)} onClose={onClose} title={video.title} variant="center" widthClassName="max-w-2xl">
      <div className="space-y-3">
        <YoutubePlayer videoId={video.youtubeId} />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold", tone.bg, tone.text)}>
            <BookOpen className="h-3 w-3" /> {video.subject}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-cream-muted px-2.5 py-1 text-[11px] font-semibold text-espresso-muted dark:bg-white/10 dark:text-cream/50">
            <GraduationCap className="h-3 w-3" /> {video.grade}. Sınıf
          </span>
          <span className="flex items-center gap-1 rounded-full bg-cream-muted px-2.5 py-1 text-[11px] font-semibold text-espresso-muted dark:bg-white/10 dark:text-cream/50">
            <Layers className="h-3 w-3" /> {video.topic}
          </span>
        </div>
        {video.description && <p className="text-xs leading-relaxed text-espresso-muted dark:text-cream/50">{video.description}</p>}
        <button
          onClick={() => onAssign(video)}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          <Send className="h-4 w-4" /> Öğrenciye Ata
        </button>
      </div>
    </Modal>
  );
}
