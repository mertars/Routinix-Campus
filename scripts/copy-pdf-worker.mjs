// pdfjs-dist'in worker script'ini public/'a kopyalar — Next.js webpack build'i
// bu dosyayı doğrudan bundle etmeye çalışırsa "import.meta paket dışında
// kullanılamaz" hatası verir (bkz. lib/bulk-import/parse-pdf.ts). npm install
// sonrası otomatik çalışır (package.json > scripts > postinstall).
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const source = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const targetDir = join(root, "public");
const target = join(targetDir, "pdf.worker.min.mjs");

if (!existsSync(source)) {
  console.warn("pdfjs-dist worker bulunamadı, atlanıyor:", source);
  process.exit(0);
}
if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log("pdf.worker.min.mjs public/ dizinine kopyalandı.");
