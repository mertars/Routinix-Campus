import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "materials");

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

// Gerçek üretimde bu fonksiyonun gövdesi bir S3/Cloud Storage istemcisiyle
// değiştirilir — çağıran API route değişmeden kalır (bkz. save-question-image.ts).
export async function saveTeacherMaterial(file: File): Promise<{ fileUrl: string; fileType: "pdf" | "doc" | "slide"; sizeLabel: string }> {
  await mkdir(UPLOAD_DIR, { recursive: true });

  const originalName = file.name || "materyal";
  const extension = (originalName.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "").slice(0, 6) || "bin";
  const filename = `${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return {
    fileUrl: `/uploads/materials/${filename}`,
    fileType: inferMaterialFileType(originalName),
    sizeLabel: formatFileSize(buffer.byteLength),
  };
}
