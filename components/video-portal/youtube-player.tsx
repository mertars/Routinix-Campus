"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  RotateCw,
  RotateCcw,
  Loader2,
  Settings,
  X,
  Gauge,
  MonitorPlay,
  Captions,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
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
const YOUTUBE_API_LOAD_TIMEOUT_MS = 10_000;

// Kullanıcı isteği (2026-09-04) — "kişiselleştirebilir miyiz" + "altyazı/
// kalite/hız gibi YouTube özelliklerini getir, ince işçilik istiyorum":
// native kontrol çubuğu (playerVars: controls:0) TAMAMEN kaldırılıp
// YERİNE IFrame Player API'nin postMessage tabanlı JS kontrolüyle
// (playVideo/pauseVideo/seekTo/setPlaybackRate/setPlaybackQuality/
// loadModule('captions')) sıfırdan çizilen bir kontrol çubuğu — YouTube'un
// kendi ayarlar menüsüyle AYNI iki katmanlı deseni (ana menü → alt menü)
// taklit ediyor, ama tamamen bizim tasarımımız. TEK kalıcı iz: köşedeki
// küçük YouTube logosu (kaldırılamıyor) — üstüne kurum rozeti biniyor.
// Denetim bulgusu (2026-09-05) — bu script'in yüklenmesi başarısız olursa
// (ağ hatası, reklam/izleyici engelleyici, kurumsal güvenlik duvarı —
// youtube.com'u engelleyen ortamlar nadir değil) `apiPromise` NE ÇÖZÜLÜYOR
// NE DE REDDEDİLİYORDU — oynatıcı sonsuza dek yükleniyor spinner'ında
// kalıyordu. DAHA KÖTÜSÜ: `apiPromise` modül seviyesinde bir singleton —
// bir kez "zehirlenince" (hiç resolve/reject olmadan asılı kalınca) o
// sayfa yüklemesinde AÇILAN HER YoutubePlayer (yönetici önizleme, öğrenci
// izleme modalı) aynı ölü promise'e bağlanıp aynı şekilde asılı kalıyordu.
// Artık: (1) script.onerror reddediyor, (2) bir zaman aşımı reddediyor,
// (3) reddedilirse apiPromise SIFIRLANIYOR ki bir sonraki mount yeniden
// denesin.
function loadYoutubeApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    const timeout = setTimeout(() => reject(new Error("YouTube oynatıcı zaman aşımına uğradı.")), YOUTUBE_API_LOAD_TIMEOUT_MS);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("YouTube oynatıcı betiği yüklenemedi."));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    apiPromise = null;
    throw error;
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

// Kullanıcı talebi (2026-09-04) — "kalıpların dışına çık, hareketli":
// klasik dikey açılır liste yerine, dişli düğmesinin etrafında YAY
// üzerinde fırlayan bir radyal menü. İki katman: "main" (Altyazı/Kalite/
// Hız ikonları, dar yayda) → birine dokununca "speed"/"quality" (o
// ayarın DEĞERLERİ, daha geniş bir yayda küçük kapsüller olarak açılır).
// Geometri notu: açı 0°=yukarı, negatif=sola doğru dönüyor; -90..0
// aralığında kalmak y bileşenini hep negatif (yukarı) tutuyor — bu yüzden
// hiçbir düğüm kontrol çubuğunun ALTINA taşmıyor.
type RadialLevel = "closed" | "main" | "speed" | "quality";

function arcPoint(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: radius * Math.sin(rad), y: -radius * Math.cos(rad) };
}

function spreadAngles(count: number, from: number, to: number): number[] {
  if (count <= 1) return [(from + to) / 2];
  const step = (to - from) / (count - 1);
  return Array.from({ length: count }, (_, i) => from + step * i);
}

const MAIN_NODE = 36;
const VALUE_NODE_W = 46;
const VALUE_NODE_H = 26;

// Kaldığı yerden devam (2026-09-05) — `initialPositionSeconds` sağlanırsa
// (öğrencinin bu videoda en son bıraktığı yer, bkz. VideoAssignment.
// lastPositionSeconds) hazır olur olmaz oraya atlanır; birkaç saniyeden
// az/videonun sonuna çok yakınsa atlanmaz (baştan izlemek daha doğal).
// `onFirstPlay` artık videonun süresini de taşıyor — video zaten bilinen
// süresini ayrıca YouTube'a sormaya gerek kalmasın diye (bkz.
// Video.durationSeconds); ayrı bir "onDuration" callback'i EKLEMEDİK
// çünkü `onReady` ilk oynatmadan ÖNCE de tetiklenebilir — o an "izlendi"
// işaretlemek YANLIŞ olurdu, süre bilgisini de aynı, TEK doğru an olan
// ilk oynatmayla birlikte taşımak daha güvenli. `onProgress` oynatılırken
// ~10 saniyede bir VE duraklat/bitir anında çağrılır — çağıran taraf bunu
// periyodik olarak sunucuya yazar (bkz. videos.tsx > reportProgress).
const RESUME_MIN_SECONDS = 5;
const RESUME_END_BUFFER_SECONDS = 15;
const PROGRESS_REPORT_INTERVAL_SECONDS = 10;

export function YoutubePlayer({
  videoId,
  onFirstPlay,
  initialPositionSeconds,
  onProgress,
  className,
}: {
  videoId: string;
  onFirstPlay?: (durationSeconds: number) => void;
  initialPositionSeconds?: number;
  onProgress?: (seconds: number) => void;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  // Düzeltme (2026-09-05, 2. geçiş) — İLK deneme "pseudoFullscreen açıkken
  // TÜM ağacı createPortal'a sar" şeklindeydi. Bu YANLIŞTI: React, aynı
  // ağaç konumunda düz bir element ile portal arasında geçiş yapınca bunu
  // FARKLI bir "tip" sayıp TÜM ALT AĞACI SÖKÜP YENİDEN KURUYOR — mountRef'e
  // bağlı canlı YouTube iframe'i (eski, artık koparılmış DOM node'una
  // bağlıydı) yok oluyordu. Sonuç: tam ekrana geçiyor (siyah arkaplan
  // görünüyor) ama video hiç görünmüyordu (bkz. kullanıcı geri bildirimi
  // "tam ekran geçiyor ekran simsiyah kalıyor").
  //
  // Doğru çözüm: createPortal'a HER ZAMAN AYNI (referans olarak sabit) bir
  // DOM node veriliyor — `portalRootRef.current`, bileşenin ömrü boyunca
  // bir kez oluşturulur, asla değişmez. React bu yüzden portalı ASLA
  // yeniden bağlamıyor, içindeki iframe/YT.Player canlı kalıyor. Bu sabit
  // node'un FİZİKSEL olarak NEREYE TAKILI olduğunu (placeholder'ın içi mi,
  // yoksa document.body mi) React'ın dışında, düz DOM appendChild'ıyla BİZ
  // değiştiriyoruz — appendChild zaten DOM'da olan bir node'u SÖKMEDEN
  // TAŞIR, bu yüzden iframe hiç kesintiye uğramıyor.
  const portalRootRef = useRef<HTMLDivElement | null>(null);
  if (!portalRootRef.current && typeof document !== "undefined") {
    portalRootRef.current = document.createElement("div");
  }
  const seekBarRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [volumeExpanded, setVolumeExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // bkz. components/ui/modal.tsx'teki AYNI not — bu oynatıcı neredeyse
  // HER YERDE bir Modal'ın (framer-motion transform'lu) içinde render
  // ediliyor; `pseudoFullscreen` sırasında "fixed inset-0" o transformlu
  // atanın içine SIKIŞIR, gerçek viewport'u kaplamaz — bu yüzden içerik
  // pseudoFullscreen açıkken document.body'ye taşınıyor (bkz.
  // portalRootRef üstündeki not — TAŞIMA, yeniden bağlama DEĞİL).
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [scrubHoverRatio, setScrubHoverRatio] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [radialLevel, setRadialLevel] = useState<RadialLevel>("closed");
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [availableRates, setAvailableRates] = useState<number[]>([1]);
  const [quality, setQuality] = useState("auto");
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [ccEnabled, setCcEnabled] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const hasFiredFirstPlay = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastReportedRef = useRef(0);

  useEffect(() => {
    let destroyed = false;
    setReady(false);
    setLoadError(false);
    loadYoutubeApi()
      .then(() => {
        if (destroyed || !mountRef.current || !window.YT) return;
        playerRef.current = new window.YT.Player(mountRef.current, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: { controls: 0, rel: 0, modestbranding: 1, disablekb: 1, fs: 0, playsinline: 1, cc_load_policy: 0 },
          events: {
            onReady: (event: { target: YTPlayerInstance }) => {
              if (destroyed) return;
              const p = event.target;
              const videoDuration = p.getDuration();
              setDuration(videoDuration);
              setVolume(p.getVolume());
              setAvailableRates(p.getAvailablePlaybackRates?.() ?? [1]);
              setAvailableQualities((p.getAvailableQualityLevels?.() ?? []).filter((q) => q !== "auto"));
              if (
                initialPositionSeconds &&
                initialPositionSeconds > RESUME_MIN_SECONDS &&
                initialPositionSeconds < videoDuration - RESUME_END_BUFFER_SECONDS
              ) {
                p.seekTo(initialPositionSeconds, true);
                setCurrentTime(initialPositionSeconds);
                lastReportedRef.current = initialPositionSeconds;
              }
              setReady(true);
            },
            onStateChange: (event: { data: number; target: YTPlayerInstance }) => {
              if (!window.YT) return;
              if (event.data === window.YT.PlayerState.PLAYING) {
                setPlaying(true);
                if (!hasFiredFirstPlay.current) {
                  hasFiredFirstPlay.current = true;
                  onFirstPlay?.(event.target.getDuration());
                }
              } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
                setPlaying(false);
                onProgress?.(event.target.getCurrentTime());
              }
            },
          },
        });
      })
      .catch(() => {
        if (!destroyed) setLoadError(true);
      });
    return () => {
      destroyed = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, retryKey]);

  useEffect(() => {
    if (!playing) return;
    pollTimer.current = setInterval(() => {
      if (!playerRef.current || scrubbing) return;
      const t = playerRef.current.getCurrentTime();
      setCurrentTime(t);
      setBuffered(playerRef.current.getVideoLoadedFraction());
      if (onProgress && t - lastReportedRef.current >= PROGRESS_REPORT_INTERVAL_SECONDS) {
        lastReportedRef.current = t;
        onProgress(t);
      }
    }, 250);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, scrubbing]);

  useEffect(() => {
    function handleFullscreenChange() {
      setFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Kullanıcı geri bildirimi (2026-09-05) — "telefonda öğrenci panelinde
  // video tam ekran olmuyor": iOS Safari (ve bazı eski Android WebView'lar)
  // Fullscreen API'yi rastgele elementlerde (bizim durumumuzda oynatıcının
  // dış div'i) desteklemiyor/reddediyor — sadece <video> etiketinde çalışır,
  // biz ise özel kontrol çubuğu için bir <div> sarmalıyoruz. Bu yüzden
  // gövde kilitlenmiş (scroll'suz) CSS tabanlı bir "sahte tam ekran"a
  // (fixed+inset-0) düşülüyor — hangi tarayıcı olursa olsun her zaman
  // çalışır.
  useEffect(() => {
    if (!pseudoFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [pseudoFullscreen]);

  // portalRootRef'in (bkz. yukarıdaki not) FİZİKSEL DOM konumunu değiştirir
  // — appendChild zaten bağlı bir node'u SÖKMEDEN taşır, bu yüzden içindeki
  // canlı YouTube iframe'i kesintiye uğramaz. useLayoutEffect (useEffect
  // değil) kullanılıyor ki taşıma boyaTAN ÖNCE olsun, bir kare bile
  // "içeriksiz" görünmesin.
  useLayoutEffect(() => {
    const portalRoot = portalRootRef.current;
    if (!portalRoot) return;
    if (pseudoFullscreen) {
      portalRoot.style.position = "fixed";
      portalRoot.style.inset = "0";
      portalRoot.style.zIndex = "999";
      document.body.appendChild(portalRoot);
    } else if (placeholderRef.current) {
      portalRoot.style.position = "absolute";
      portalRoot.style.inset = "0";
      portalRoot.style.zIndex = "auto";
      placeholderRef.current.appendChild(portalRoot);
    }
  }, [pseudoFullscreen]);

  // Bileşen kaldırılınca portalRoot'u DOM'dan temizle (React'ın kendi
  // portal temizliği bu, React AĞACININ dışına elle eklediğimiz için
  // gerekli — normal bir portal hedefinde bu adıma gerek olmazdı).
  useEffect(() => {
    const portalRoot = portalRootRef.current;
    return () => {
      portalRoot?.remove();
    };
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

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    if (pseudoFullscreen) {
      setPseudoFullscreen(false);
      return;
    }
    if (containerRef.current?.requestFullscreen) {
      try {
        await containerRef.current.requestFullscreen();
        // Mobilde yatay konumda izlemek daha doğal — destekleniyorsa dene,
        // desteklenmiyorsa (ör. iOS Safari) sessizce yut.
        const orientation = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } }).orientation;
        orientation?.lock?.("landscape").catch(() => {});
        return;
      } catch {
        // requestFullscreen VAR ama reddedildi (iOS Safari'nin arbitrary
        // elementler için tipik davranışı) — aşağıdaki sahte tam ekrana düş.
      }
    }
    setPseudoFullscreen(true);
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
    setRadialLevel("closed");
  }

  function selectQuality(q: string) {
    playerRef.current?.setPlaybackQuality(q);
    setQuality(q);
    setRadialLevel("closed");
  }

  function scheduleHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setShowControls(false);
      setRadialLevel("closed");
    }, 2800);
  }

  const progressRatio = duration > 0 ? currentTime / duration : 0;
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
  const controlsVisible = showControls || !playing || radialLevel !== "closed";

  type MainItem = { key: string; icon: LucideIcon; active: boolean; onClick: () => void };
  const mainItems: MainItem[] = [
    { key: "cc", icon: Captions, active: ccEnabled, onClick: () => { toggleCaptions(); setRadialLevel("closed"); } },
    ...(availableQualities.length > 0
      ? [{ key: "quality", icon: MonitorPlay, active: quality !== "auto", onClick: () => setRadialLevel("quality") }]
      : []),
    { key: "speed", icon: Gauge, active: playbackRate !== 1, onClick: () => setRadialLevel("speed") },
  ];

  type ValueItem = { key: string; label: string; active: boolean; onClick: () => void };
  const speedItems: ValueItem[] = SPEED_OPTIONS.filter((r) => availableRates.includes(r) || r === 1).map((rate) => ({
    key: String(rate),
    label: rate === 1 ? "1x" : `${rate}x`,
    active: rate === playbackRate,
    onClick: () => selectRate(rate),
  }));
  const qualityItems: ValueItem[] = [
    { key: "auto", label: "Oto", active: quality === "auto", onClick: () => selectQuality("auto") },
    ...availableQualities.map((q) => ({ key: q, label: QUALITY_LABELS[q] ?? q, active: q === quality, onClick: () => selectQuality(q) })),
  ];
  const valueItems = radialLevel === "speed" ? speedItems : radialLevel === "quality" ? qualityItems : [];

  const player = (
    <div
      ref={containerRef}
      className={cn("group absolute inset-0 select-none overflow-hidden bg-black", !pseudoFullscreen && "rounded-2xl")}
      onMouseMove={() => {
        setShowControls(true);
        scheduleHide();
      }}
      onMouseLeave={() => playing && radialLevel === "closed" && setShowControls(false)}
      onTouchStart={() => {
        setShowControls(true);
        scheduleHide();
      }}
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

      {!ready && loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black px-4 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-400" />
          <p className="text-xs text-white/70">Oynatıcı yüklenemedi. İnternet bağlantını kontrol et.</p>
          <button
            onClick={() => {
              setLoadError(false);
              setRetryKey((k) => k + 1);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Tekrar dene
          </button>
        </div>
      )}
      {!ready && !loadError && (
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

            {/* Ses — hoparlör ikonuna gelince (masaüstü) YA DA dokununca
                (dokunmatik cihazlarda ":hover" hiç tetiklenmediği için
                — bkz. denetim bulgusu 2026-09-05) yanında bir seviye
                kaydırıcısı açılıyor. */}
            <div className="group/volume flex items-center gap-1.5" onTouchStart={() => setVolumeExpanded((v) => !v)}>
              <button onClick={toggleMute} aria-label={muted ? "Sesi aç" : "Sesi kapat"} className="transition hover:scale-110">
                <VolumeIcon className="h-4 w-4" />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className={cn(
                  "h-1 cursor-pointer appearance-none overflow-hidden rounded-full bg-white/25 accent-violet-500 transition-all duration-200 group-hover/volume:w-16 group-hover/volume:opacity-100",
                  volumeExpanded ? "w-16 opacity-100" : "w-0 opacity-0"
                )}
              />
            </div>

            <span className="text-[11px] font-medium tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            {/* Radyal ayarlar menüsü — Altyazı/Kalite/Hız düğmesinin
                etrafında yay üzerinde fırlıyor (bkz. RadialLevel notu). */}
            <div className="relative">
              {radialLevel !== "closed" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/25 blur-2xl"
                />
              )}

              <button
                onClick={() => setRadialLevel((v) => (v === "closed" ? "main" : "closed"))}
                aria-label="Ayarlar"
                className={cn(
                  "relative z-10 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300",
                  radialLevel !== "closed" ? "rotate-90 bg-violet-500/90 text-white" : "hover:rotate-45"
                )}
              >
                {radialLevel !== "closed" ? <X className="h-3.5 w-3.5" /> : <Settings className="h-4 w-4" />}
              </button>

              <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
                <AnimatePresence>
                  {radialLevel === "main" &&
                    mainItems.map((item, i) => {
                      const angle = spreadAngles(mainItems.length, -82, -8)[i];
                      const { x, y } = arcPoint(angle, 58);
                      const Icon = item.icon;
                      return (
                        <motion.button
                          key={item.key}
                          onClick={item.onClick}
                          aria-label={item.key}
                          initial={{ x: -MAIN_NODE / 2, y: -MAIN_NODE / 2, scale: 0, opacity: 0 }}
                          animate={{ x: x - MAIN_NODE / 2, y: y - MAIN_NODE / 2, scale: 1, opacity: 1 }}
                          exit={{ x: -MAIN_NODE / 2, y: -MAIN_NODE / 2, scale: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 340, damping: 22, delay: i * 0.035 }}
                          style={{ width: MAIN_NODE, height: MAIN_NODE }}
                          className={cn(
                            "pointer-events-auto absolute left-0 top-0 flex items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-colors",
                            item.active
                              ? "border-violet-400 bg-violet-500/90 text-white"
                              : "border-white/15 bg-midnight-card/95 text-cream hover:border-violet-400/60 hover:text-violet-300"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </motion.button>
                      );
                    })}

                  {valueItems.map((item, i) => {
                    const angle = spreadAngles(valueItems.length, -87, -3)[i];
                    const { x, y } = arcPoint(angle, 94);
                    return (
                      <motion.button
                        key={item.key}
                        onClick={item.onClick}
                        initial={{ x: -VALUE_NODE_W / 2, y: -VALUE_NODE_H / 2, scale: 0, opacity: 0 }}
                        animate={{ x: x - VALUE_NODE_W / 2, y: y - VALUE_NODE_H / 2, scale: 1, opacity: 1 }}
                        exit={{ x: -VALUE_NODE_W / 2, y: -VALUE_NODE_H / 2, scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 340, damping: 22, delay: i * 0.02 }}
                        style={{ width: VALUE_NODE_W, height: VALUE_NODE_H }}
                        className={cn(
                          "pointer-events-auto absolute left-0 top-0 flex items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums shadow-lg backdrop-blur-md transition-colors",
                          item.active
                            ? "border-violet-400 bg-violet-500/90 text-white"
                            : "border-white/15 bg-midnight-card/95 text-cream/85 hover:border-violet-400/60 hover:text-violet-300"
                        )}
                      >
                        {item.label}
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            <button onClick={toggleFullscreen} aria-label="Tam ekran" className="transition hover:scale-110">
              {fullscreen || pseudoFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Layout'ta yer tutan, görünmez "yuva" — gerçek içerik (bkz.
          portalRootRef) buraya (normalde) ya da document.body'ye (tam
          ekranda) TAŞINIR; bu div'in KENDİSİ hiçbir zaman portallanmıyor,
          bu yüzden aşağıdaki portal HER ZAMAN aynı hedefe (portalRootRef.
          current) sahip olup React'ın onu yeniden bağlamasını engelliyor. */}
      <div ref={placeholderRef} className={cn("relative aspect-video w-full overflow-hidden rounded-2xl", className)} />
      {portalRootRef.current && createPortal(player, portalRootRef.current)}
    </>
  );
}
