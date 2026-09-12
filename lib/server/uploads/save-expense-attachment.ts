import { randomUUID } from "crypto";
import { putObject, getPublicUrl, deleteObject, publicUrlToKey } from "@/lib/server/r2";

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

// Gider eki kaydeder — R2'ye (kalıcı, herkese açık okunur kova) yazar.
// ⚠️ ESKİDEN public/uploads/expenses altına yerel diske yazıyordu — bu
// yalnızca `next dev`'de çalışıyordu, Vercel üretiminde dosya hiç kalıcı
// olmuyordu (bkz. lib/server/r2.ts üstündeki 2026-09-13 notu).
//
// Dosya adı RASTGELE üretilir; kullanıcının verdiği ad veritabanında
// ayrıca saklanır. Sebep: yüklenen adı doğrudan yola koymak yol
// gezinme (../) ve çakışma riski taşır.
export async function saveExpenseAttachment(file: File): Promise<{ url: string; name: string; sizeLabel: string }> {
  const originalName = file.name || "fis";
  const extension = (originalName.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "").slice(0, 6) || "bin";
  const key = `expenses/${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await putObject(key, buffer, file.type || "application/octet-stream");

  return {
    url: getPublicUrl(key),
    name: originalName,
    sizeLabel: formatFileSize(buffer.byteLength),
  };
}

// Ek değiştirilirken/silinirken eski dosyayı temizler.
//
// Silme başarısız olursa İŞLEM DURMAZ: veritabanı kaydı doğru olduğu
// sürece kovada artık bir nesne kalması, kullanıcının ek
// güncelleyememesinden daha küçük bir sorundur.
export async function deleteExpenseAttachment(url: string | null): Promise<void> {
  if (!url) return;
  const key = publicUrlToKey(url);
  if (!key) return;
  await deleteObject(key).catch(() => {});
}
