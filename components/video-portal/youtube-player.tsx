"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCw, Loader2 } from "lucide-react";
import { InstitutionBadgeIcon } from "@/components/ui/institution-badge-icon";
import { cn } from "@/lib/utils";

// YouTube IFrame Player API'sinin tip tanımlarını burada elle YAZMIYORUZ
// (resmi bir @types paketi yok) — sadece kullandığımız yüzeyi `any` ile
// daraltıyoruz, tip güvenliğini KAYBETMEDEN gereksiz bir bağımlılık
// eklemekten kaçınıyoruz.
declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, options: Record<string, unknown>) => YTPlayerInstance;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YTPlayerInstance = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};

let apiPromise: Promise<void> | null = null;

// Kullanıcı isteği (2026-09-04) — "bu oynatıcıyı kişiselleştirebilir
// miyiz": native YouTube kontrol çubuğu (oynat/durdur, ses, ayarlar
// dişlisi, paylaş, başlık/kanal bilgisi) TAMAMEN kaldırılıp (playerVars:
// controls:0) YERİNE kendi tasarımımızla (video-player.tsx'in R2 dönemi
// tasarımıyla AYNI dil) sürülüyor — IFrame Player API'nin postMessage
// tabanlı JS kontrolüyle (playVideo/pauseVideo/seekTo). TEK kalıcı iz:
// videonun kendi köşesindeki küçük YouTube logosu — bu, YouTube'un
// kullanım şartları gereği KALDIRILAMIYOR (bkz. kullanıcıyla yapılan
// tartışma), geri kalan HER ŞEY bizim arayüzümüz.
function loadYoutubeApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function YoutubePlayer({ videoId, onFirstPlay, className }: { videoId: string; onFirstPlay?: () => void; className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hasFiredFirstPlay = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let destroyed = false;
    setReady(false);
    loadYoutubeApi().then(() => {
      if (destroyed || !mountRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(mountRef.current, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { controls: 0, rel: 0, modestbranding: 1, disablekb: 1, fs: 0, playsinline: 1 },
        events: {
          onReady: (event: { target: YTPlayerInstance }) => {
            if (destroyed) return;
            setDuration(event.target.getDuration());
            setReady(true);
          },
          onStateChange: (event: { data: number }) => {
            if (!window.YT) return;
            if (event.data === window.YT.PlayerState.PLAYING) {
              setPlaying(true);
              if (!hasFiredFirstPlay.current) {
                hasFiredFirstPlay.current = true;
                onFirstPlay?.();
              }
            } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
              setPlaying(false);
            }
          },
        },
      });
    });
    return () => {
      destroyed = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => {
    if (!playing) return;
    pollTimer.current = setInterval(() => {
      if (playerRef.current) setCurrentTime(playerRef.current.getCurrentTime());
    }, 250);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [playing]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    []
  );

  function togglePlay() {
    if (!playerRef.current) return;
    if (playing) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  }

  function handleSeek(event: React.ChangeEvent<HTMLInputElement>) {
    const value = Number(event.target.value);
    playerRef.current?.seekTo(value, true);
    setCurrentTime(value);
  }

  function toggleMute() {
    if (!playerRef.current) return;
    if (muted) {
      playerRef.current.unMute();
      setMuted(false);
    } else {
      playerRef.current.mute();
      setMuted(true);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen();
  }

  function skip(delta: number) {
    if (!playerRef.current) return;
    const next = Math.min(Math.max(playerRef.current.getCurrentTime() + delta, 0), duration);
    playerRef.current.seekTo(next, true);
    setCurrentTime(next);
  }

  function scheduleHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 2500);
  }

  return (
    <div
      ref={containerRef}
      className={cn("group relative aspect-video w-full overflow-hidden rounded-2xl bg-black", className)}
      onMouseMove={() => {
        setShowControls(true);
        scheduleHide();
      }}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <div ref={mountRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* Kullanıcı isteği (2026-09-04) — kurumun kendi logosu köşede
          görünsün. Aynı zamanda YouTube'un kendi (kaldırılamayan, bkz.
          dosya başındaki not) köşe filigranının ÜSTÜNE biniyor — YouTube'un
          çıktısını DEĞİŞTİRMİYOR, sadece kendi arayüzümüzden bir öğeyi
          onun üstüne koyuyoruz (controls'tan bağımsız, HER ZAMAN görünür). */}
      {ready && (
        <div className="pointer-events-none absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 shadow-md backdrop-blur-sm">
          <InstitutionBadgeIcon className="h-4 w-4 text-white" />
        </div>
      )}

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <Loader2 className="h-6 w-6 animate-spin text-white/50" />
        </div>
      )}

      {ready && !playing && (
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

      {ready && (
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
            <button onClick={() => skip(10)} aria-label="10 saniye ileri">
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
      )}
    </div>
  );
}
