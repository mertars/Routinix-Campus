"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Heading as HeadingIcon,
  Type as TypeIcon,
  FileText,
  BarChart3,
  LineChart as LineChartIcon,
  Layers,
  Users,
  Table as TableIcon,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Download,
  Share2,
  Plus,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { fetchAndDownloadPdf, fetchAndSharePdf } from "@/lib/client/download-pdf";
import { cn } from "@/lib/utils";

type BlockType = "heading" | "text" | "summary" | "subtopicScan" | "trend" | "doubleExposure" | "branchAverage" | "history";

type LocalBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "summary" }
  | { id: string; type: "subtopicScan"; subtopicIds: string[] | null }
  | { id: string; type: "trend"; from: string | null; to: string | null }
  | { id: string; type: "doubleExposure" }
  | { id: string; type: "branchAverage"; branchId: string }
  | { id: string; type: "history"; subtopicIds: string[] | null; from: string | null; to: string | null };

type SubtopicOption = { subtopicId: string; name: string };

const PALETTE: { type: BlockType; label: string; icon: typeof HeadingIcon }[] = [
  { type: "heading", label: "Başlık/Ayraç", icon: HeadingIcon },
  { type: "text", label: "Yazı", icon: TypeIcon },
  { type: "summary", label: "Genel Özet", icon: FileText },
  { type: "subtopicScan", label: "Konu Bazlı Tarama", icon: BarChart3 },
  { type: "trend", label: "Gelişim Eğrisi", icon: LineChartIcon },
  { type: "doubleExposure", label: "Çift Pozlama", icon: Layers },
  { type: "branchAverage", label: "Şube Karşılaştırması", icon: Users },
  { type: "history", label: "Test Geçmişi", icon: TableIcon },
];

function defaultBlockFor(type: BlockType, branchId: string): LocalBlock {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  switch (type) {
    case "heading":
      return { id, type, text: "Yeni Başlık" };
    case "text":
      return { id, type, text: "" };
    case "summary":
      return { id, type };
    case "subtopicScan":
      return { id, type, subtopicIds: null };
    case "trend":
      return { id, type, from: null, to: null };
    case "doubleExposure":
      return { id, type };
    case "branchAverage":
      return { id, type, branchId };
    case "history":
      return { id, type, subtopicIds: null, from: null, to: null };
  }
}

function stripId(block: LocalBlock) {
  const { id: _id, ...rest } = block;
  return rest;
}

// Faz Q — "Özel PDF Oluşturucu": kullanıcı talebi "istediği konuların
// istediği tarihteki grafiklerini eklesin, yazılar ekleyebilsin... canlı
// önizlemesini görsün". Bu kod tabanında react-pdf'in tarayıcıda render
// eden <PDFViewer>'ı HİÇ kullanılmıyor (9 PDF component'i de sunucuda
// renderToBuffer ile üretiliyor) — yeni/kanıtlanmamış bir client-render
// deseni yerine, "canlı önizleme" AYNI /api/xray/custom-report ucuna
// debounce'lı POST atıp dönen PDF'i bir <iframe>'de göstererek sağlanır.
// Final indirme/paylaşma AYNI ucu kullanır — önizleme ile çıktı arasında
// tutarsızlık riski YOK.
export function XrayCustomReportBuilder({
  isOpen,
  onClose,
  studentId,
  studentName,
  branchId,
  subject,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  branchId: string;
  subject: string;
}) {
  const { showError } = useToast();
  const [blocks, setBlocks] = useState<LocalBlock[]>([]);
  const [subtopicOptions, setSubtopicOptions] = useState<SubtopicOption[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setBlocks([]);
    fetch(`/api/xray/results/${encodeURIComponent(studentId)}?subject=${encodeURIComponent(subject)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => {
        const opts: SubtopicOption[] = (data.topics ?? []).flatMap((t: { subtopics: { subtopicId: string; name: string }[] }) => t.subtopics);
        setSubtopicOptions(opts);
      })
      .catch(() => setSubtopicOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, studentId, subject]);

  useEffect(() => {
    if (!isOpen || blocks.length === 0) {
      setPreviewUrl(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setRendering(true);
      try {
        const res = await fetch("/api/xray/custom-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, subject, blocks: blocks.map(stripId) }),
        });
        if (!res.ok) throw new Error("Önizleme oluşturulamadı.");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      } catch {
        // sessizce geç — önizleme başarısız olsa bile blok düzenlemeye devam edilebilir
      } finally {
        setRendering(false);
      }
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, isOpen, studentId, subject]);

  useEffect(() => {
    if (!isOpen && previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewUrl(null);
    }
  }, [isOpen]);

  function addBlock(type: BlockType) {
    setBlocks((prev) => [...prev, defaultBlockFor(type, branchId)]);
  }
  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }
  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      const swapWith = idx + dir;
      if (idx < 0 || swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }
  function updateBlock(id: string, patch: Partial<LocalBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? ({ ...b, ...patch } as LocalBlock) : b)));
  }

  const fileName = useMemo(() => `${studentName}-ozel-rontgen-raporu.pdf`.replace(/\s+/g, "-"), [studentName]);
  const requestInit = useMemo(
    () => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, subject, blocks: blocks.map(stripId) }) }),
    [studentId, subject, blocks]
  );

  async function handleDownload() {
    setDownloading(true);
    try {
      await fetchAndDownloadPdf("/api/xray/custom-report", requestInit, fileName);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Rapor oluşturulamadı.");
    } finally {
      setDownloading(false);
    }
  }
  async function handleShare() {
    setSharing(true);
    try {
      await fetchAndSharePdf("/api/xray/custom-report", requestInit, fileName, `${studentName} — Özel Röntgen Raporu`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Rapor oluşturulamadı.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Özel PDF Oluştur" variant="center" widthClassName="max-w-6xl">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
        {/* SOL — blok paleti + eklenen bloklar */}
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Blok Ekle</p>
            <div className="grid grid-cols-2 gap-1.5">
              {PALETTE.map((p) => (
                <button
                  key={p.type}
                  onClick={() => addBlock(p.type)}
                  className="flex items-center gap-1.5 rounded-lg border border-hairline bg-white/60 px-2.5 py-2 text-left text-[11px] font-medium text-espresso transition hover:border-sky-400/40 hover:bg-sky-500/5 dark:border-white/10 dark:bg-midnight-card/40 dark:text-cream"
                >
                  <p.icon className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                  <span className="truncate">{p.label}</span>
                  <Plus className="ml-auto h-3 w-3 shrink-0 text-espresso-muted dark:text-cream/40" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Rapor İçeriği ({blocks.length})</p>
            {blocks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-hairline bg-white/30 px-3 py-6 text-center text-[11px] text-espresso-muted dark:border-white/10 dark:bg-white/5 dark:text-cream/40">
                Yukarıdan blok ekleyerek başla.
              </p>
            ) : (
              <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
                {blocks.map((b, i) => (
                  <BlockEditor
                    key={b.id}
                    block={b}
                    index={i}
                    total={blocks.length}
                    subtopicOptions={subtopicOptions}
                    onChange={(patch) => updateBlock(b.id, patch)}
                    onRemove={() => removeBlock(b.id)}
                    onMove={(dir) => moveBlock(b.id, dir)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t border-hairline pt-3 dark:border-white/10">
            <button
              onClick={handleDownload}
              disabled={downloading || blocks.length === 0}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} İndir
            </button>
            <button
              onClick={handleShare}
              disabled={sharing || blocks.length === 0}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-500/20 disabled:opacity-50 dark:text-sky-300"
            >
              {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />} Paylaş
            </button>
          </div>
        </div>

        {/* SAĞ — canlı önizleme */}
        <div className="relative min-h-[50vh] overflow-hidden rounded-2xl border border-hairline bg-cream-card dark:border-white/10 dark:bg-white/5">
          {rendering && (
            <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white">
              <Loader2 className="h-3 w-3 animate-spin" /> Güncelleniyor
            </div>
          )}
          {previewUrl ? (
            <iframe title="Özel PDF Önizleme" src={previewUrl} className="h-full min-h-[50vh] w-full" />
          ) : (
            <div className="flex h-full min-h-[50vh] items-center justify-center px-6 text-center text-xs text-espresso-muted dark:text-cream/40">
              Blok eklediğinde canlı önizleme burada görünecek.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function BlockEditor({
  block,
  index,
  total,
  subtopicOptions,
  onChange,
  onRemove,
  onMove,
}: {
  block: LocalBlock;
  index: number;
  total: number;
  subtopicOptions: SubtopicOption[];
  onChange: (patch: Partial<LocalBlock>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const meta = PALETTE.find((p) => p.type === block.type)!;
  const [expanded, setExpanded] = useState(false);
  const hasConfig = block.type === "heading" || block.type === "text" || block.type === "subtopicScan" || block.type === "trend" || block.type === "history";

  return (
    <div className="rounded-xl border border-hairline bg-white/60 p-2.5 dark:border-white/10 dark:bg-midnight-card/40">
      <div className="flex items-center gap-2">
        <meta.icon className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
        <button onClick={() => hasConfig && setExpanded((v) => !v)} className={cn("flex-1 truncate text-left text-[11px] font-medium text-espresso dark:text-cream", hasConfig && "cursor-pointer")}>
          {meta.label}
          {block.type === "heading" && block.text && `: ${block.text}`}
        </button>
        <button onClick={() => onMove(-1)} disabled={index === 0} className="text-espresso-muted transition hover:text-espresso disabled:opacity-30 dark:text-cream/40">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} className="text-espresso-muted transition hover:text-espresso disabled:opacity-30 dark:text-cream/40">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button onClick={onRemove} className="text-espresso-muted transition hover:text-rose-600 dark:text-cream/40">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && block.type === "heading" && (
        <input
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<LocalBlock>)}
          placeholder="Başlık metni"
          className="mt-2 w-full rounded-lg border border-hairline bg-white px-2 py-1.5 text-[11px] text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        />
      )}

      {expanded && block.type === "text" && (
        <textarea
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<LocalBlock>)}
          placeholder="Serbest metin..."
          rows={3}
          className="mt-2 w-full rounded-lg border border-hairline bg-white px-2 py-1.5 text-[11px] text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        />
      )}

      {expanded && (block.type === "trend" || block.type === "history") && (
        <div className="mt-2 flex gap-1.5">
          <input
            type="date"
            value={block.from ?? ""}
            onChange={(e) => onChange({ from: e.target.value || null } as Partial<LocalBlock>)}
            className="flex-1 rounded-lg border border-hairline bg-white px-2 py-1.5 text-[10px] text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
          <input
            type="date"
            value={block.to ?? ""}
            onChange={(e) => onChange({ to: e.target.value || null } as Partial<LocalBlock>)}
            className="flex-1 rounded-lg border border-hairline bg-white px-2 py-1.5 text-[10px] text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>
      )}

      {expanded && (block.type === "subtopicScan" || block.type === "history") && (
        <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-lg border border-hairline bg-white/50 p-1.5 dark:border-white/10 dark:bg-white/5">
          <label className="flex items-center gap-1.5 px-1 py-0.5 text-[10px] text-espresso dark:text-cream">
            <input type="checkbox" checked={block.subtopicIds === null} onChange={(e) => onChange({ subtopicIds: e.target.checked ? null : [] } as Partial<LocalBlock>)} />
            Tüm konular
          </label>
          {block.subtopicIds !== null &&
            subtopicOptions.map((opt) => (
              <label key={opt.subtopicId} className="flex items-center gap-1.5 px-1 py-0.5 text-[10px] text-espresso dark:text-cream">
                <input
                  type="checkbox"
                  checked={block.subtopicIds!.includes(opt.subtopicId)}
                  onChange={(e) => {
                    const ids = block.subtopicIds!;
                    onChange({ subtopicIds: e.target.checked ? [...ids, opt.subtopicId] : ids.filter((x) => x !== opt.subtopicId) } as Partial<LocalBlock>);
                  }}
                />
                {opt.name}
              </label>
            ))}
        </div>
      )}
    </div>
  );
}
