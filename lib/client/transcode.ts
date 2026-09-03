import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// Video Ders Merkezi — kullanıcı geri bildirimi (2026-09-03): iPhone'un
// varsayılan HEVC (.mov) kaydı çoğu tarayıcıda oynatılamıyor ("0:00" kalıp
// oynamıyordu). Kullanıcı kararı: üçüncü taraf bir video servisine
// KAYDOLMADAN çözülsün — bu yüzden dönüştürme SUNUCUDA değil, TARAYICIDA
// (ffmpeg.wasm) yapılıyor. Sıfır yeni sunucu/hesap/aylık maliyet — bedeli
// admin'in kendi bilgisayarının işi yapması (yavaş olabilir, büyük
// videolarda birkaç dakika sürebilir) ve sekmenin açık kalması gerekmesi.
// Çekirdek dosyalar (~30MB) bir CDN'DEN DEĞİL, kendi public/ffmpeg/
// klasörümüzden yükleniyor (bkz. scripts/copy-ffmpeg-core.mjs) — hem CSP'ye
// yeni bir dış domain eklemek gerekmesin hem üçüncü taraf bağımlılığı
// olmasın diye.
let ffmpegPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript"),
        toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm"),
      ]);
      await ffmpeg.load({ coreURL, wasmURL });
      return ffmpeg;
    })();
  }
  return ffmpegPromise;
}

function fileExtension(name: string): string {
  const match = name.match(/\.[^.]+$/);
  return match ? match[0] : ".mp4";
}

// Tarayıcının bir dosyayı NATIVE olarak oynatıp oynatamadığını, gerçekten
// oynatmaya ÇALIŞMADAN (sessizce metadata okumaya çalışarak) test eder —
// başarılıysa (süre okunabildiyse) dönüştürmeye HİÇ gerek yok, zaman
// kaybetmeyelim.
export function canPlayNatively(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const cleanup = (result: boolean) => {
      URL.revokeObjectURL(url);
      resolve(result);
    };
    video.onloadedmetadata = () => cleanup(Number.isFinite(video.duration) && video.duration > 0);
    video.onerror = () => cleanup(false);
    video.src = url;
  });
}

export async function transcodeToMp4(file: File, onProgress?: (ratio: number) => void): Promise<File> {
  const ffmpeg = await getFFmpeg();
  const progressListener = onProgress ? ({ progress }: { progress: number }) => onProgress(Math.min(Math.max(progress, 0), 1)) : undefined;
  if (progressListener) ffmpeg.on("progress", progressListener);

  const inputName = `input${fileExtension(file.name)}`;
  const outputName = "output.mp4";
  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    // -preset veryfast — WASM'ın tek çekirdekli/yavaş CPU bütçesine göre
    // hız/kalite dengesi; -movflags +faststart — MP4 metadata'sını dosyanın
    // BAŞINA taşır, web'de arama/tarama (seek) çubuğunun ilk baytlardan
    // itibaren çalışması için (aksi halde tüm dosya inmeden seek bozuk olur).
    await ffmpeg.exec(["-i", inputName, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", outputName]);
    const data = await ffmpeg.readFile(outputName);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
    return new File([bytes.slice()], file.name.replace(/\.[^.]+$/, "") + ".mp4", { type: "video/mp4" });
  } finally {
    if (progressListener) ffmpeg.off("progress", progressListener);
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}
