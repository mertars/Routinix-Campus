// @ffmpeg/core'un (ffmpeg.wasm) UMD çekirdek dosyalarını public/ffmpeg/'e
// kopyalar — Video Ders Merkezi'nin tarayıcı-içi dönüştürücüsü (bkz.
// lib/client/transcode.ts) bunları AYNI origin'den (jsdelivr/unpkg gibi bir
// CDN'den DEĞİL) yükler: hem üçüncü taraf bağımlılığı olmasın hem de CSP'ye
// yeni bir dış domain eklemek gerekmesin diye (bkz. pdf.worker.min.mjs'i
// kopyalayan AYNI desen, copy-pdf-worker.mjs). npm install sonrası otomatik
// çalışır (package.json > scripts > postinstall).
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const sourceDir = join(root, "node_modules", "@ffmpeg", "core", "dist", "umd");
const targetDir = join(root, "public", "ffmpeg");

const files = ["ffmpeg-core.js", "ffmpeg-core.wasm"];

if (!existsSync(sourceDir)) {
  console.warn("@ffmpeg/core bulunamadı, atlanıyor:", sourceDir);
  process.exit(0);
}
if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  copyFileSync(join(sourceDir, file), join(targetDir, file));
}
console.log("ffmpeg-core.js/.wasm public/ffmpeg/ dizinine kopyalandı.");
