"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize, RotateCw, Loader2, Settings, ChevronLeft, ChevronRight, Check, Captions } from "lucide-react";
import { InstitutionBadgeIcon } from "@/components/ui/institution-badge-icon";
import { cn } from "@/lib/utils";

// YouTube IFrame Player API'sinin tip tanımlarını burada elle YAZMIYORUZ
// (resmi bir @types paketi yok) — sadece kullandığımız yüzeyi daraltıyoruz.
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
  isMuted: () => boolean;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVideoLoadedFraction: () => number;
  setPlaybackRate: (rate: number) => void;
  getPlaybackRate: () => number;
  getAvailablePlaybackRates: () => number[];
  setPlaybackQuality: (quality: string) => void;
  getPlaybackQuality: () => string;
  getAvailableQualityLevels: () => string[];
  loadModule: (module: string) => void;
  unloadModule: (module: string) => void;
  destroy: () => void;
};

let apiPromise: Promise<void> | null = null;

// Kullanıcı isteği (2026-09-04) — "kişiselleştirebilir miyiz" + "altyazı/
// kalite/hız gibi YouTube özelliklerini getir, ince işçilik istiyorum":
// native kontrol çubuğu (playerVars: controls:0) TAMAMEN kaldırılıp
// YERİNE IFrame Player API'nin postMessage tabanlı JS kontrolüyle
// (playVideo/pauseVideo/seekTo/setPlaybackRate/setPlaybackQuality/
// loadModule('captions')) sıfırdan çizilen bir kontrol çubuğu — YouTube'un
// kendi ayarlar menüsüyle AYNI iki katmanlı deseni (ana menü → alt menü)
// taklit ediyor, ama tamamen bizim tasarımımız. TEK kalıcı iz: köşedeki
// küçük YouTube logosu (kaldırılamıyor) — üstüne kurum rozeti biniyor.
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
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const QUALITY_LABELS: Record<string, string> = {
  hd2160: "4K",
  hd1440: "1440p",
  hd1080: "1080p",
  hd720: "720p",
  large: "480p",
  medium: "360p",
  small: "240p",
  tiny: "144p",
  auto: "Otomatik",
};

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

type SettingsPanel = null | "main" | "speed" | "quality";

export function YoutubePlayer({ videoId, onFirstPlay, className }: { videoId: string; onFirstPlay?: () => void; className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [scrubHoverRatio, setScrubHoverRatio] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>(null);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [availableRates, setAvailableRates] = useState<number[]>([1]);
  const [quality, setQuality] = useState("auto");
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [ccEnabled, setCcEnabled] = useState(false);
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
        playerVars: { controls: 0, rel: 0, modestbranding: 1, disablekb: 1, fs: 0, playsinline: 1, cc_load_policy: 0 },
        events: {
          onReady: (event: { target: YTPlayerInstance }) => {
            if (destroyed) return;
            const p = event.target;
            setDuration(p.getDuration());
            setVolume(p.getVolume());
            setAvailableRates(p.getAvailablePlaybackRates?.() ?? [1]);
            setAvailableQualities((p.getAvailableQualityLevels?.() ?? []).filter((q) => q !== "auto"));
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
      if (!playerRef.current || scrubbing) return;
      setCurrentTime(playerRef.current.getCurrentTime());
      setBuffered(playerRef.current.getVideoLoadedFraction());
    }, 250);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [playing, scrubbing]);

  useEffect(() => {
    function handleFullscreenChange() {
      setFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

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

  function handleVolumeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = Number(event.target.value);
    playerRef.current?.setVolume(value);
    setVolume(value);
    if (value === 0) {
      playerRef.current?.mute();
      setMuted(true);
    } else if (muted) {
      playerRef.current?.unMute();
      setMuted(false);
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

  function ratioFromPointer(clientX: number): number {
    const rect = seekBarRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  }

  function handleSeekPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setScrubbing(true);
    const ratio = ratioFromPointer(event.clientX);
    setCurrentTime(ratio * duration);
  }

  function handleSeekPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const ratio = ratioFromPointer(event.clientX);
    setScrubHoverRatio(ratio);
    if (scrubbing) setCurrentTime(ratio * duration);
  }

  function handleSeekPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!scrubbing) return;
    const ratio = ratioFromPointer(event.clientX);
    playerRef.current?.seekTo(ratio * duration, true);
    setCurrentTime(ratio * duration);
    setScrubbing(false);
  }

  function toggleCaptions() {
    if (!playerRef.current) return;
    if (ccEnabled) playerRef.current.unloadModule("captions");
    else playerRef.current.loadModule("captions");
    setCcEnabled((v) => !v);
  }

  function selectRate(rate: number) {
    playerRef.current?.setPlaybackRate(rate);
    setPlaybackRateState(rate);
    setSettingsPanel(null);
  }

  function selectQuality(q: string) {
    playerRef.current?.setPlaybackQuality(q);
    setQuality(q);
    setSettingsPanel(null);
  }

  function scheduleHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setShowControls(false);
      setSettingsPanel(null);
    }, 2800);
  }

  const progressRatio = duration > 0 ? currentTime / duration : 0;
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
  const controlsVisible = showControls || !playing || settingsPanel !== null;

  return (
    <div
      ref={containerRef}
      className={cn("group relative aspect-video w-full select-none overflow-hidden rounded-2xl bg-black", className)}
      onMouseMove={() => {
        setShowControls(true);
        scheduleHide();
      }}
      onMouseLeave={() => playing && settingsPanel === null && setShowControls(false)}
    >
      <div ref={mountRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* Kurum rozeti — YouTube'un kaldırılamayan köşe filigranının ÜSTÜNE
          biniyor (bkz. dosya başındaki not), controls'tan bağımsız her
          zaman görünür. */}
      {ready && (
        <div className="pointer-events-none absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 shadow-md backdrop-blur-sm">
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
            "absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2.5 pt-8 transition-opacity duration-200",
            controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          {/* Arama çubuğu — arabelleğe alınan (buffered) ve oynatılan
              kısmı ayrı katmanlarda gösteren, sürükle-bırak (pointer
              capture) ile kaydırılabilen, üstüne gelince zaman ipucu
              çıkan ÖZEL bir çubuk — native <input type=range> bunu
              gösteremediği için tamamen elle çizildi. */}
          <div
            ref={seekBarRef}
            onPointerDown={handleSeekPointerDown}
            onPointerMove={handleSeekPointerMove}
            onPointerUp={handleSeekPointerUp}
            onPointerLeave={() => !scrubbing && setScrubHoverRatio(null)}
            className="group/seek relative flex h-3.5 w-full cursor-pointer items-center"
          >
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/25 transition-all group-hover/seek:h-1.5">
              <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${buffered * 100}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-violet-500" style={{ width: `${progressRatio * 100}%` }} />
            </div>
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full bg-violet-400 opacity-0 shadow transition-opacity group-hover/seek:opacity-100"
              style={{ left: `${progressRatio * 100}%` }}
            />
            {scrubHoverRatio !== null && (
              <div
                className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-md bg-black/90 px-1.5 py-1 text-[10px] font-medium tabular-nums text-white shadow"
                style={{ left: `${scrubHoverRatio * 100}%` }}
              >
                {formatTime(scrubHoverRatio * duration)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 text-white">
            <button onClick={togglePlay} aria-label={playing ? "Duraklat" : "Oynat"} className="transition hover:scale-110">
              {playing ? <Pause className="h-4.5 w-4.5" fill="currentColor" /> : <Play className="h-4.5 w-4.5" fill="currentColor" />}
            </button>
            <button onClick={() => skip(10)} aria-label="10 saniye ileri" className="transition hover:scale-110">
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Ses — hoparlör ikonuna gelince yanında bir seviye
                kaydırıcısı açılıyor (YouTube'un kendi deseni). */}
            <div className="group/volume flex items-center gap-1.5">
              <button onClick={toggleMute} aria-label={muted ? "Sesi aç" : "Sesi kapat"} className="transition hover:scale-110">
                <VolumeIcon className="h-4 w-4" />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="h-1 w-0 cursor-pointer appearance-none overflow-hidden rounded-full bg-white/25 opacity-0 accent-violet-500 transition-all duration-200 group-hover/volume:w-16 group-hover/volume:opacity-100"
              />
            </div>

            <span className="text-[11px] font-medium tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            {/* Altyazı — YouTube'un kendi captions modülünü aç/kapat. */}
            <button
              onClick={toggleCaptions}
              aria-label="Altyazı"
              className={cn("rounded px-0.5 transition hover:scale-110", ccEnabled ? "text-violet-400" : "text-white")}
            >
              <Captions className="h-4 w-4" />
            </button>

            {/* Ayarlar — hız + kalite, YouTube'un kendi ana menü/alt menü
                (geri okuyla) desenini taklit ediyor. */}
            <div className="relative">
              <button
                onClick={() => setSettingsPanel((v) => (v ? null : "main"))}
                aria-label="Ayarlar"
                className={cn("transition hover:rotate-45", settingsPanel && "text-violet-400")}
              >
                <Settings className="h-4 w-4" />
              </button>
              {settingsPanel && (
                <div className="absolute bottom-full right-0 z-10 mb-3 w-48 overflow-hidden rounded-2xl border border-white/15 bg-midnight-card/95 py-1 shadow-2xl backdrop-blur-2xl">
                  {settingsPanel === "main" && (
                    <>
                      <button
                        onClick={() => setSettingsPanel("speed")}
                        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[12.5px] font-medium text-cream transition hover:bg-white/10"
                      >
                        Oynatma Hızı
                        <span className="flex items-center gap-1 text-cream/50">
                          {playbackRate === 1 ? "Normal" : `${playbackRate}x`} <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </button>
                      {availableQualities.length > 0 && (
                        <button
                          onClick={() => setSettingsPanel("quality")}
                          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[12.5px] font-medium text-cream transition hover:bg-white/10"
                        >
                          Kalite
                          <span className="flex items-center gap-1 text-cream/50">
                            {QUALITY_LABELS[quality] ?? quality} <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </button>
                      )}
                    </>
                  )}
                  {settingsPanel === "speed" && (
                    <>
                      <button
                        onClick={() => setSettingsPanel("main")}
                        className="flex w-full items-center gap-1.5 border-b border-white/10 px-3.5 py-2 text-left text-[12px] font-semibold text-cream/70 transition hover:text-cream"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Oynatma Hızı
                      </button>
                      <div className="max-h-52 overflow-y-auto py-1">
                        {SPEED_OPTIONS.filter((r) => availableRates.includes(r) || r === 1).map((rate) => (
                          <button
                            key={rate}
                            onClick={() => selectRate(rate)}
                            className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[12.5px] font-medium text-cream transition hover:bg-white/10"
                          >
                            <Check className={cn("h-3.5 w-3.5 shrink-0", rate === playbackRate ? "opacity-100" : "opacity-0")} />
                            {rate === 1 ? "Normal" : `${rate}x`}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {settingsPanel === "quality" && (
                    <>
                      <button
                        onClick={() => setSettingsPanel("main")}
                        className="flex w-full items-center gap-1.5 border-b border-white/10 px-3.5 py-2 text-left text-[12px] font-semibold text-cream/70 transition hover:text-cream"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Kalite
                      </button>
                      <div className="max-h-52 overflow-y-auto py-1">
                        <button
                          onClick={() => selectQuality("auto")}
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[12.5px] font-medium text-cream transition hover:bg-white/10"
                        >
                          <Check className={cn("h-3.5 w-3.5 shrink-0", quality === "auto" ? "opacity-100" : "opacity-0")} />
                          Otomatik
                        </button>
                        {availableQualities.map((q) => (
                          <button
                            key={q}
                            onClick={() => selectQuality(q)}
                            className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[12.5px] font-medium text-cream transition hover:bg-white/10"
                          >
                            <Check className={cn("h-3.5 w-3.5 shrink-0", q === quality ? "opacity-100" : "opacity-0")} />
                            {QUALITY_LABELS[q] ?? q}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <button onClick={toggleFullscreen} aria-label="Tam ekran" className="transition hover:scale-110">
              {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
