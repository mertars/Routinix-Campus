import { randomUUID } from "crypto";
import { putObject, getPublicUrl } from "@/lib/server/r2";

export const MAX_MATERIAL_BYTES = 20 * 1024 * 1024;

const EXTENSION_TO_TYPE: Record<string, "pdf" | "doc" | "slide"> = {
  pdf: "pdf",
  doc: "doc",
  docx: "doc",
  ppt: "slide",
  pptx: "slide",
};

export function inferMaterialFileType(filename: string): "pdf" | "doc" | "slide" {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TO_TYPE[extension] ?? "doc";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Görseli/dokümanı R2'ye (kalıcı, herkese açık okunur kova) yazar.
// ⚠️ ESKİDEN public/uploads/materials altına yerel diske yazıyordu — bu
// yalnızca `next dev`'de çalışıyordu, Vercel üretiminde dosya hiç kalıcı
// olmuyordu (bkz. lib/server/r2.ts üstündeki 2026-09-13 notu).
export async function saveTeacherMaterial(file: File): Promise<{ fileUrl: string; fileType: "pdf" | "doc" | "slide"; sizeLabel: string }> {
  const originalName = file.name || "materyal";
  const extension = (originalName.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "").slice(0, 6) || "bin";
  const key = `materials/${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await putObject(key, buffer, file.type || "application/octet-stream");

  return {
    fileUrl: getPublicUrl(key),
    fileType: inferMaterialFileType(originalName),
    sizeLabel: formatFileSize(buffer.byteLength),
  };
}
