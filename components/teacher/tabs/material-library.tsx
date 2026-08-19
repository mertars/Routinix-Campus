"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileText, FileType2, Presentation, UploadCloud, Download, Check, Loader2 } from "lucide-react";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type TeacherMaterial = { id: string; title: string; branchId: string; fileUrl: string; fileType: "pdf" | "doc" | "slide"; sizeLabel: string; createdAt: string };

const FILE_ICON: Record<TeacherMaterial["fileType"], typeof FileText> = {
  pdf: FileText,
  doc: FileType2,
  slide: Presentation,
};

export function MaterialLibraryTab() {
  const { staffRecord, assignedBranches } = useTeacherScope();
  const { showError } = useToast();
  const [materials, setMaterials] = useState<TeacherMaterial[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadAll() {
    if (assignedBranches.length === 0) return;
    try {
      const results = await Promise.all(
        assignedBranches.map((b) => fetch(`/api/materials?branchId=${encodeURIComponent(b.id)}`).then((res) => res.json()))
      );
      setMaterials(results.flatMap((r) => r.materials ?? []));
    } catch {
      showError("Materyal kütüphanesi yüklenemedi.");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedBranches.map((b) => b.id).join(",")]);

  async function handleUpload(file: File) {
    if (!assignedBranches[0]) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("teacherId", staffRecord.id);
      form.append("branchId", assignedBranches[0].id);
      const res = await fetch("/api/materials", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Yükleme başarısız.");
      setMaterials((prev) => [data.material, ...prev]);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Yükleme başarısız.");
    } finally {
      setUploading(false);
    }
  }

  function handleDownload(material: TeacherMaterial) {
    const link = document.createElement("a");
    link.href = material.fileUrl;
    link.download = material.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadedIds((prev) => [...prev, material.id]);
    setTimeout(() => setDownloadedIds((prev) => prev.filter((id) => id !== material.id)), 2000);
  }

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        onClick={() => !uploading && inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-hairline bg-white/70 px-6 py-8 text-center shadow-sm backdrop-blur-sm transition hover:border-brand-600/40 dark:border-white/10 dark:bg-midnight-card/70"
      >
        {uploading ? <Loader2 className="h-6 w-6 animate-spin text-brand-600" /> : <UploadCloud className="h-6 w-6 text-brand-600" />}
        <p className="text-sm font-medium text-espresso dark:text-cream">{uploading ? "Yükleniyor..." : "Ders materyali yükle"}</p>
        <p className="text-xs text-espresso-muted dark:text-cream/40">PDF, DOC veya sunum dosyası seçin</p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleUpload(file);
            event.target.value = "";
          }}
        />
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70"
      >
        <h2 className="mb-3 text-sm font-semibold text-espresso dark:text-cream">Kütüphanem ({materials.length})</h2>
        <div className="space-y-2">
          {materials.map((material, index) => {
            const Icon = FILE_ICON[material.fileType];
            const branchName = assignedBranches.find((b) => b.id === material.branchId)?.name ?? "";
            return (
              <motion.div
                key={material.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className="flex items-center justify-between gap-3 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0 text-brand-600" />
                  <div>
                    <p className="text-sm font-medium text-espresso dark:text-cream">{material.title}</p>
                    <p className="text-[11px] text-espresso-muted dark:text-cream/40">
                      {branchName} · {material.sizeLabel} · {new Date(material.createdAt).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(material)}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition",
                    downloadedIds.includes(material.id)
                      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                      : "text-espresso-muted hover:bg-white dark:text-cream/40 dark:hover:bg-white/10"
                  )}
                >
                  {downloadedIds.includes(material.id) ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                </button>
              </motion.div>
            );
          })}
          {materials.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz materyal yüklenmedi.</p>}
        </div>
      </motion.div>
    </div>
  );
}
