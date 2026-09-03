"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Kullanıcı kararı (2026-09-03) — "kendi video sistemimiz, hiçbir üçüncü
// taraf izi olmasın" (B2B satış konumlandırması: "hızlı ve güvenli çalışan
// kendi video sistemimiz"). Bu yüzden YouTube iframe'i (bkz. eski
// youtube-embed.tsx, artık kullanılmıyor) yerine SIFIRDAN, tamamen bizim
// kontrol çubuğumuzla çizilen bir <video> oynatıcı — R2'deki dosyayı
// doğrudan servis eder, hiçbir marka/logo/iz taşımaz.
export function VideoPlayer({ src, onFirstPlay, className }: { src: string; onFirstPlay?: () => void; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hasFiredFirstPlay = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  function handlePlay() {
    setPlaying(true);
    if (!hasFiredFirstPlay.current) {
      hasFiredFirstPlay.current = true;
      onFirstPlay?.();
    }
  }

  function handleSeek(event: React.ChangeEvent<HTMLInputElement>) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Number(event.target.value);
    setCurrentTime(Number(event.target.value));
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function toggleFullscreen() {
    const container = videoRef.current?.closest("[data-video-container]");
    if (!container) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else container.requestFullscreen();
  }

  function skip(delta: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), duration);
  }

  function scheduleHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 2500);
  }

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  return (
    <div
      data-video-container
      className={cn("group relative aspect-video w-full overflow-hidden rounded-2xl bg-black", className)}
      onMouseMove={() => {
        setShowControls(true);
        scheduleHide();
      }}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        className="absolute inset-0 h-full w-full"
        onClick={togglePlay}
        onPlay={handlePlay}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
        playsInline
      />

      {!playing && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition hover:bg-black/30"
          aria-label="Oynat"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-violet-700 shadow-lg transition group-hover:scale-105">
            <Play className="ml-1 h-7 w-7" fill="currentColor" />
          </span>
        </button>
      )}

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-6 transition-opacity duration-200",
          showControls || !playing ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-violet-500"
        />
        <div className="flex items-center gap-2.5 text-white">
          <button onClick={togglePlay} aria-label={playing ? "Duraklat" : "Oynat"}>
            {playing ? <Pause className="h-4.5 w-4.5" /> : <Play className="h-4.5 w-4.5" fill="currentColor" />}
          </button>
          <button onClick={() => skip(10)} aria-label="10 saniye ileri" className="flex items-center">
            <RotateCw className="h-4 w-4" />
          </button>
          <span className="text-[11px] font-medium tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="flex-1" />
          <button onClick={toggleMute} aria-label={muted ? "Sesi aç" : "Sesi kapat"}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button onClick={toggleFullscreen} aria-label="Tam ekran">
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
