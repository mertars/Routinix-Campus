"use client";

import { useMemo, useRef, useState } from "react";
import { Clapperboard, Film, Loader2, CheckCircle2, Wand2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { VIDEO_SUBJECTS } from "@/lib/video-subjects";
import { canPlayNatively, transcodeToMp4 } from "@/lib/client/transcode";
import type { VideoLesson } from "@/components/video-portal/video-portal-panel";

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => resolve(null);
    video.src = URL.createObjectURL(file);
  });
}

// XMLHttpRequest — fetch'in aksine yükleme İLERLEME OLAYLARINI (upload
// progress) destekliyor, büyük video dosyalarında bir ilerleme çubuğu
// gösterebilmek için bilerek bunu kullanıyoruz.
function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Yükleme başarısız (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Yükleme sırasında ağ hatası."));
    xhr.send(file);
  });
}

// "Video Ekle" — kullanıcı kararı (2026-09-03): R2 tabanlı gerçek yükleme.
// Akış: 1) /api/videos/presign'dan imzalı PUT URL'i al, 2) dosyayı
// TARAYICIDAN DOĞRUDAN R2'ye yükle (bizim sunucumuzdan GEÇMEDEN — büyük
// dosyalar Vercel fonksiyon sınırlarına takılmasın diye), 3) başarılı
// olunca /api/videos'a metadata+r2Key'i kaydet.
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [grade, setGrade] = useState(9);
  const [subject, setSubject] = useState<string>(VIDEO_SUBJECTS[0]);
  const [topic, setTopic] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [stage, setStage] = useState<"idle" | "checking" | "transcoding" | "uploading" | "saving" | "done">("idle");

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

  const canSave = Boolean(file) && title.trim().length > 0 && topic.trim().length > 0 && stage === "idle";

  function reset() {
    setFile(null);
    setTitle("");
    setDescription("");
    setGrade(9);
    setSubject(VIDEO_SUBJECTS[0]);
    setTopic("");
    setProgress(null);
    setStage("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    if (!title.trim()) setTitle(selected.name.replace(/\.[^.]+$/, ""));
  }

  async function handleSave() {
    if (!file || !canSave) return;
    setStage("checking");
    setProgress(null);
    try {
      // Kullanıcı geri bildirimi (2026-09-03) — iPhone'un varsayılan HEVC
      // (.mov) kaydı çoğu tarayıcıda oynatılamıyordu ("0:00" kalıp
      // oynamıyordu). Önce dosyanın TARAYICIDA native oynatılıp
      // oynatılamadığını sessizce test ediyoruz — oynatılabiliyorsa
      // dönüştürmeye hiç GEREK yok (zaman kaybetmeyelim); oynatılamıyorsa
      // ffmpeg.wasm ile TARAYICIDA (sunucu/üçüncü taraf servis OLMADAN)
      // standart H.264 MP4'e çeviriyoruz (bkz. lib/client/transcode.ts).
      let uploadFile = file;
      const playable = await canPlayNatively(file);
      if (!playable) {
        setStage("transcoding");
        setProgress(0);
        uploadFile = await transcodeToMp4(file, (ratio) => setProgress(Math.round(ratio * 100)));
      }

      setStage("uploading");
      setProgress(0);
      const durationSeconds = await readVideoDuration(uploadFile);
      const presignRes = await fetch("/api/videos/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: uploadFile.name, contentType: uploadFile.type }),
      }).then((res) => (res.ok ? res.json() : Promise.reject(new Error())));

      await uploadWithProgress(presignRes.uploadUrl, uploadFile, setProgress);

      setStage("saving");
      const saveRes = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          grade,
          subject,
          topic: topic.trim(),
          r2Key: presignRes.key,
          durationSeconds: durationSeconds ? Math.round(durationSeconds) : undefined,
        }),
      });
      if (!saveRes.ok) throw new Error();
      const data = await saveRes.json();

      setStage("done");
      onAdded(data.video);
      reset();
      onClose();
    } catch {
      showError("Video yüklenemedi. Lütfen tekrar dene.");
      setStage("idle");
      setProgress(null);
    }
  }

  const busy = stage !== "idle";

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (busy) return;
        reset();
        onClose();
      }}
      title="Video Ekle"
      variant="center"
      widthClassName="max-w-lg"
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Video Dosyası</label>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-hairline bg-cream-card px-3.5 py-3 text-left transition hover:border-violet-400/50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5"
          >
            <Film className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-espresso dark:text-cream">{file ? file.name : "Herhangi bir video dosyası seç..."}</span>
          </button>
          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
          <p className="mt-1 text-[10px] text-espresso-muted dark:text-cream/40">Tarayıcının oynatamadığı formatlar (ör. iPhone HEVC) otomatik olarak dönüştürülür.</p>
        </div>

        {stage === "checking" && (
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Video formatı kontrol ediliyor...
          </p>
        )}
        {stage === "transcoding" && progress !== null && (
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-espresso-muted dark:text-cream/40">
              <span className="flex items-center gap-1.5">
                <Wand2 className="h-3 w-3" /> Uyumlu formata dönüştürülüyor (bu biraz sürebilir)...
              </span>
              <span>%{progress}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
              <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {stage === "uploading" && progress !== null && (
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-espresso-muted dark:text-cream/40">
              <span>Depoya yükleniyor...</span>
              <span>%{progress}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
              <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {stage === "saving" && (
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Kütüphaneye kaydediliyor...
          </p>
        )}
        {stage === "done" && (
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Eklendi
          </p>
        )}

        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Video Başlığı</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
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
            disabled={busy}
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
            disabled={busy}
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
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
          {stage === "transcoding" ? "Dönüştürülüyor..." : busy ? "Yükleniyor..." : "Kütüphaneye Ekle"}
        </button>
      </div>
    </Modal>
  );
}
