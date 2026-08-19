import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "questions");

export const MAX_QUESTION_IMAGE_BYTES = 8 * 1024 * 1024;

// Görseli yerel diske (public/uploads/questions) kaydeder ve tarayıcıdan
// doğrudan erişilebilir bir yol döner. Gerçek üretimde bu fonksiyonun
// gövdesi bir S3/Cloud Storage istemcisiyle değiştirilir — çağıran kodun
// (API route) geri kalanı değişmeden kalır, tıpkı SMS sağlayıcısı gibi.
export async function saveQuestionImage(file: File): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });

  const extension = (file.type.split("/")[1] ?? "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
  const filename = `${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return `/uploads/questions/${filename}`;
}
