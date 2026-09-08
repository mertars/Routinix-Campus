import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "expenses");

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// Fiş/fatura için makul biçimler: telefonla çekilen fotoğraf ve
// e-fatura PDF'i. Başka bir şey (örn. .exe, .zip) gider kaydının
// arkasında belge sayılmaz ve gereksiz risk taşır.
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "pdf"];

export function isAllowedAttachment(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_EXTENSIONS.includes(ext);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Gider eki kaydeder.
//
// Projedeki mevcut yükleme deseniyle AYNI (bkz. save-teacher-material.ts):
// dosya public/uploads altına yazılır, gerçek üretimde bu fonksiyonun
// gövdesi bir S3/R2 istemcisiyle değiştirilir, çağıran route değişmeden
// kalır.
//
// Dosya adı RASTGELE üretilir; kullanıcının verdiği ad veritabanında
// ayrıca saklanır. Sebep: yüklenen adı doğrudan yola koymak yol
// gezinme (../) ve çakışma riski taşır.
export async function saveExpenseAttachment(file: File): Promise<{ url: string; name: string; sizeLabel: string }> {
  await mkdir(UPLOAD_DIR, { recursive: true });

  const originalName = file.name || "fis";
  const extension = (originalName.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "").slice(0, 6) || "bin";
  const filename = `${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return {
    url: `/uploads/expenses/${filename}`,
    name: originalName,
    sizeLabel: formatFileSize(buffer.byteLength),
  };
}

// Ek değiştirilirken/silinirken eski dosyayı temizler.
//
// Silme başarısız olursa İŞLEM DURMAZ: veritabanı kaydı doğru olduğu
// sürece diskte artık bir dosya kalması, kullanıcının ek
// güncelleyememesinden daha küçük bir sorundur.
export async function deleteExpenseAttachment(url: string | null): Promise<void> {
  if (!url || !url.startsWith("/uploads/expenses/")) return;
  try {
    await unlink(path.join(process.cwd(), "public", url));
  } catch {
    // yoksayılır
  }
}
