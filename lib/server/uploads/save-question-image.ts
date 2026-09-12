import { randomUUID } from "crypto";
import { putObject, getPublicUrl } from "@/lib/server/r2";

export const MAX_QUESTION_IMAGE_BYTES = 8 * 1024 * 1024;

// Görseli R2'ye (kalıcı, herkese açık okunur kova) yazar ve tam URL döner.
// ⚠️ ESKİDEN public/uploads/questions altına yerel diske yazıyordu — bu
// yalnızca `next dev`'de çalışıyordu, Vercel üretiminde dosya hiç kalıcı
// olmuyordu (bkz. lib/server/r2.ts üstündeki 2026-09-13 notu).
export async function saveQuestionImage(file: File): Promise<string> {
  const extension = (file.type.split("/")[1] ?? "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
  const key = `questions/${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await putObject(key, buffer, file.type || "application/octet-stream");
  return getPublicUrl(key);
}
