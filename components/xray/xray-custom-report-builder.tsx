"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
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
  X,
} from "lucide-react";
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
type Severity = "critical" | "moderate" | "strong";
type Recommendation = { subtopicId: string; name: string; masteryScore: number; severity: Severity; advice: string };
type RoadmapData = { summary: { averageScore: number; criticalCount: number; moderateCount: number; strongCount: number; overallAdvice: string }; recommendations: Recommendation[] };
type HistoryPoint = { assessedAt: string; average: number; subtopicId: string; masteryScore: number; subtopicName: string };
type PlacementData = { hasPlacement: false } | { hasPlacement: true; before: { avg: number; assessedAt: string }; after: { avg: number; assessedAt: string } };
type BranchAverageData = { branchName: string; branchAverage: number };

const PALETTE: { type: BlockType; label: string; icon: typeof HeadingIcon }[] = [
  { type: "heading", label: "Başlık", icon: HeadingIcon },
  { type: "text", label: "Yazı", icon: TypeIcon },
  { type: "summary", label: "Özet", icon: FileText },
  { type: "subtopicScan", label: "Tarama", icon: BarChart3 },
  { type: "trend", label: "Eğri", icon: LineChartIcon },
  { type: "doubleExposure", label: "Çift Pozlama", icon: Layers },
  { type: "branchAverage", label: "Şube", icon: Users },
  { type: "history", label: "Geçmiş", icon: TableIcon },
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

function scoreColor(score: number): string {
  if (score >= 60) return "#34D399";
  if (score >= 30) return "#FBBF24";
  return "#FB7185";
}

// Faz Q — kullanıcı geri bildirimi: eski sürüm HER blok değişikliğinde
// (tek harf yazsa bile) debounce'lı bir POST atıp GERÇEK bir PDF üretip
// iframe'e basıyordu — 300+ PDF üretimi, gözle görülür kasma. Bu artık
// TAMAMEN İSTEMCİ TARAFINDA, HTML/CSS ile PDF'in görsel dilini taklit eden
// bir "canlı önizleme" — hiç ağ isteği YOK, anında güncellenir. Gerekli
// veri (reçete/geçmiş/çift pozlama/şube ortalaması) SADECE builder
// açıldığında BİR KEZ (paralel, 4 hafif mevcut uçtan) çekilip önbelleğe
// alınır; blok ekleme/tarih/konu seçimi SADECE bu önbellekte filtreleme
// yapar. Gerçek PDF SADECE "İndir"/"Paylaş" tıklanınca, TEK seferde
// /api/xray/custom-report'tan üretilir.
export function XrayCustomReportBuilder({
  isOpen,
  onClose,
  studentId,
  studentName,
  branchId,
  branchName,
  subject,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  branchId: string;
  branchName: string;
  subject: string;
}) {
  const { showError } = useToast();
  const [blocks, setBlocks] = useState<LocalBlock[]>([]);
  const [subtopicOptions, setSubtopicOptions] = useState<SubtopicOption[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [placement, setPlacement] = useState<PlacementData | null>(null);
  const [branchAverage, setBranchAverage] = useState<BranchAverageData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Faz Q — TEK seferlik veri önbellekleme (bkz. yukarıdaki gerekçe).
  useEffect(() => {
    if (!isOpen) return;
    setBlocks([]);
    setLoadingData(true);
    Promise.all([
      fetch(`/api/xray/results/${encodeURIComponent(studentId)}?subject=${encodeURIComponent(subject)}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/xray/roadmap/${encodeURIComponent(studentId)}?subject=${encodeURIComponent(subject)}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/xray/mastery-history/${encodeURIComponent(studentId)}?subject=${encodeURIComponent(subject)}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/xray/placement-progress/${encodeURIComponent(studentId)}?subject=${encodeURIComponent(subject)}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/xray/branch-average?branchId=${encodeURIComponent(branchId)}&subject=${encodeURIComponent(subject)}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([results, roadmapData, historyData, placementData, branchAverageData]) => {
        const opts: SubtopicOption[] = (results?.topics ?? []).flatMap((t: { subtopics: { subtopicId: string; name: string }[] }) => t.subtopics);
        setSubtopicOptions(opts);
        setRoadmap(roadmapData ?? null);
        setHistory(historyData?.overallTrend ?? null);
        setPlacement(placementData ?? null);
        setBranchAverage(branchAverageData ? { branchName: branchAverageData.branchName, branchAverage: branchAverageData.branchAverage } : null);
      })
      .finally(() => setLoadingData(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, studentId, subject, branchId]);

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

  async function handleDownload() {
    setDownloading(true);
    try {
      await fetchAndDownloadPdf(
        "/api/xray/custom-report",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, subject, blocks: blocks.map(stripId) }) },
        fileName
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "Rapor oluşturulamadı.");
    } finally {
      setDownloading(false);
    }
  }
  async function handleShare() {
    setSharing(true);
    try {
      await fetchAndSharePdf(
        "/api/xray/custom-report",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, subject, blocks: blocks.map(stripId) }) },
        fileName,
        `${studentName} — Özel Röntgen Raporu`
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "Rapor oluşturulamadı.");
    } finally {
      setSharing(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex flex-col bg-cream dark:bg-midnight">
          {/* Üst çubuk */}
          <div className="flex shrink-0 items-center justify-between border-b border-hairline px-5 py-3.5 dark:border-white/10">
            <div>
              <h1 className="text-base font-semibold text-espresso dark:text-cream">Özel PDF Oluştur</h1>
              <p className="text-xs text-espresso-muted dark:text-cream/40">
                {studentName} · {subject}
              </p>
            </div>
            <button onClick={onClose} aria-label="Kapat" className="flex h-10 w-10 items-center justify-center rounded-full text-espresso-muted transition hover:bg-cream-card dark:text-cream/50 dark:hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Gövde */}
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* SOL — sabit üst (palet) + kayan orta (bloklar) + sabit alt (indir/paylaş) */}
            <div className="flex w-full shrink-0 flex-col border-b border-hairline dark:border-white/10 lg:w-[380px] lg:border-b-0 lg:border-r">
              <div className="shrink-0 border-b border-hairline p-4 dark:border-white/10">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Blok Ekle</p>
                <div className="flex flex-wrap gap-1.5">
                  {PALETTE.map((p) => (
                    <button
                      key={p.type}
                      onClick={() => addBlock(p.type)}
                      title={p.label}
                      className="flex items-center gap-1.5 rounded-full border border-hairline bg-white/60 px-2.5 py-1.5 text-[11px] font-medium text-espresso transition hover:border-sky-400/40 hover:bg-sky-500/5 dark:border-white/10 dark:bg-midnight-card/40 dark:text-cream"
                    >
                      <p.icon className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Rapor İçeriği ({blocks.length})</p>
                {blocks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-hairline bg-white/30 px-4 py-10 text-center text-[13px] text-espresso-muted dark:border-white/10 dark:bg-white/5 dark:text-cream/40">
                    Yukarıdan blok ekleyerek başla.
                  </p>
                ) : (
                  <div className="space-y-2.5">
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

              <div className="flex shrink-0 gap-2 border-t border-hairline p-4 dark:border-white/10">
                <button
                  onClick={handleDownload}
                  disabled={downloading || blocks.length === 0}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF Oluştur ve İndir
                </button>
                <button
                  onClick={handleShare}
                  disabled={sharing || blocks.length === 0}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-500/20 disabled:opacity-50 dark:text-sky-300"
                >
                  {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* SAĞ — anında (istemci taraflı) önizleme */}
            <div className="min-h-[50vh] flex-1 overflow-y-auto bg-[#050a12] px-4 py-8">
              {loadingData ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
                </div>
              ) : blocks.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">Blok eklediğinde önizleme burada anında görünecek.</div>
              ) : (
                <div className="mx-auto max-w-2xl rounded-2xl bg-[#0B1220] p-8 text-[#F1F5F9] shadow-2xl ring-1 ring-white/5">
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-sm font-bold text-sky-400">{branchName.charAt(0).toUpperCase()}</div>
                      <span className="text-[11px] font-bold tracking-wide text-slate-400">{branchName.toUpperCase()}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tracking-wide text-sky-400">AKADEMİK RÖNTGEN</p>
                      <p className="text-[10px] text-slate-500">{new Date().toLocaleDateString("tr-TR")}</p>
                    </div>
                  </div>
                  <div className="mb-6">
                    <p className="text-lg font-bold">{studentName}</p>
                    <p className="text-xs text-slate-400">
                      {branchName} · {subject}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {blocks.map((b) => (
                      <PreviewBlock key={b.id} block={b} roadmap={roadmap} history={history} placement={placement} branchAverage={branchAverage} />
                    ))}
                  </div>

                  <div className="mt-8 flex justify-between border-t border-slate-800 pt-3 text-[9px] text-slate-500">
                    <span>Bu rapor bir tanı testi sonucudur, kesin bir değerlendirme yerine geçmez.</span>
                    <span>Powered by Routinix Kampüs</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ==================== Önizleme blokları (saf HTML/CSS, PDF'in görsel
// dilini taklit eder — react-pdf DEĞİL, hiç ağ isteği tetiklemez) ====================

function PreviewBlock({
  block,
  roadmap,
  history,
  placement,
  branchAverage,
}: {
  block: LocalBlock;
  roadmap: RoadmapData | null;
  history: HistoryPoint[] | null;
  placement: PlacementData | null;
  branchAverage: BranchAverageData | null;
}) {
  if (block.type === "heading") {
    return <h3 className="text-base font-bold tracking-wide text-sky-400">{block.text || "(boş başlık)"}</h3>;
  }
  if (block.type === "text") {
    return <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-100">{block.text || "(boş metin)"}</p>;
  }
  if (block.type === "summary") {
    if (!roadmap) return <PreviewEmpty label="Genel Özet" />;
    const s = roadmap.summary;
    return (
      <PreviewCard label="GENEL ÖZET">
        <p className="text-[12.5px] leading-relaxed text-slate-100">{s.overallAdvice}</p>
        <p className="mt-1.5 text-[11px] text-slate-400">
          Ortalama %{s.averageScore} · {roadmap.recommendations.length} konu test edildi · {s.criticalCount} kritik, {s.moderateCount} orta, {s.strongCount} güçlü.
        </p>
      </PreviewCard>
    );
  }
  if (block.type === "subtopicScan") {
    if (!roadmap) return <PreviewEmpty label="Konu Bazlı Tarama" />;
    const recs = block.subtopicIds ? roadmap.recommendations.filter((r) => block.subtopicIds!.includes(r.subtopicId)) : roadmap.recommendations;
    return (
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">KONU BAZLI TARAMA</p>
        <div className="space-y-2">
          {recs.map((r) => (
            <div key={r.subtopicId}>
              <div className="mb-0.5 flex justify-between text-[12px]">
                <span>{r.name}</span>
                <span className="font-bold" style={{ color: scoreColor(r.masteryScore) }}>
                  %{r.masteryScore}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full" style={{ width: `${r.masteryScore}%`, backgroundColor: scoreColor(r.masteryScore) }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (block.type === "trend") {
    if (!history) return <PreviewEmpty label="Gelişim Eğrisi" />;
    const filtered = history.filter((p) => (!block.from || p.assessedAt >= block.from) && (!block.to || p.assessedAt <= `${block.to}T23:59:59`));
    if (filtered.length < 2) return <PreviewCard label="GELİŞİM EĞRİSİ"><p className="text-[11px] text-slate-500">Seçilen aralıkta yeterli veri yok.</p></PreviewCard>;
    return <TrendPreviewChart points={filtered} />;
  }
  if (block.type === "doubleExposure") {
    if (!placement || !placement.hasPlacement) return <PreviewEmpty label="Çift Pozlama (yerleştirme sınavı bulunamadı)" />;
    return (
      <PreviewCard label="ÇİFT POZLAMA — ÖNCESİ / SONRASI">
        <div className="flex items-center justify-around">
          <div className="text-center">
            <p className="text-[9px] tracking-wide text-slate-400">BAŞLANGIÇ</p>
            <p className="text-[9px] text-slate-500">{new Date(placement.before.assessedAt).toLocaleDateString("tr-TR")}</p>
            <p className="text-2xl font-bold" style={{ color: scoreColor(placement.before.avg) }}>
              %{placement.before.avg}
            </p>
          </div>
          <span className="text-lg text-slate-500">→</span>
          <div className="text-center">
            <p className="text-[9px] tracking-wide text-slate-400">BUGÜN</p>
            <p className="text-[9px] text-slate-500">{new Date(placement.after.assessedAt).toLocaleDateString("tr-TR")}</p>
            <p className="text-2xl font-bold" style={{ color: scoreColor(placement.after.avg) }}>
              %{placement.after.avg}
            </p>
          </div>
        </div>
      </PreviewCard>
    );
  }
  if (block.type === "branchAverage") {
    if (!branchAverage || !roadmap) return <PreviewEmpty label="Şube Karşılaştırması" />;
    const delta = roadmap.summary.averageScore - branchAverage.branchAverage;
    return (
      <PreviewCard label={`ŞUBE KARŞILAŞTIRMASI — ${branchAverage.branchName}`}>
        <p className="text-[12.5px] text-slate-100">
          Öğrenci ortalaması %{roadmap.summary.averageScore}, şube ortalaması %{branchAverage.branchAverage} ({delta >= 0 ? "+" : ""}
          {delta} puan fark).
        </p>
      </PreviewCard>
    );
  }
  if (block.type === "history") {
    if (!history) return <PreviewEmpty label="Test Geçmişi" />;
    const filtered = history
      .filter((p) => (!block.subtopicIds || block.subtopicIds.includes(p.subtopicId)) && (!block.from || p.assessedAt >= block.from) && (!block.to || p.assessedAt <= `${block.to}T23:59:59`))
      .slice()
      .reverse();
    return (
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">TEST GEÇMİŞİ</p>
        <div className="space-y-1">
          {filtered.slice(0, 12).map((row, i) => (
            <div key={i} className="flex justify-between border-b border-slate-800/60 py-1 text-[11px]">
              <span className="text-slate-500">{new Date(row.assessedAt).toLocaleDateString("tr-TR")}</span>
              <span className="flex-1 truncate px-2 text-slate-200">{row.subtopicName}</span>
              <span className="font-bold" style={{ color: scoreColor(row.masteryScore) }}>
                %{row.masteryScore}
              </span>
            </div>
          ))}
          {filtered.length > 12 && <p className="pt-1 text-[10px] text-slate-500">+{filtered.length - 12} satır daha (tam PDF çıktısında görünür)</p>}
          {filtered.length === 0 && <p className="text-[11px] text-slate-500">Seçilen kapsamda kayıt yok.</p>}
        </div>
      </div>
    );
  }
  return null;
}

function PreviewCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#111C33] p-3.5">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  );
}

function PreviewEmpty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 p-3.5 text-[11px] text-slate-500">
      {label} — veri yükleniyor ya da mevcut değil.
    </div>
  );
}

function TrendPreviewChart({ points }: { points: HistoryPoint[] }) {
  const width = 400;
  const height = 60;
  const values = points.map((p) => p.average);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (points.length - 1 || 1);
  const coords = points.map((p, i) => `${i * step},${height - ((p.average - min) / range) * (height - 12) - 6}`).join(" ");

  return (
    <PreviewCard label="GELİŞİM EĞRİSİ">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line x1={0} y1={height - 6} x2={width} y2={height - 6} stroke="#1E293B" strokeWidth={1} />
        <polyline points={coords} fill="none" stroke="#22D3EE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-slate-500">
        <span>{new Date(points[0].assessedAt).toLocaleDateString("tr-TR")}</span>
        <span>{new Date(points[points.length - 1].assessedAt).toLocaleDateString("tr-TR")}</span>
      </div>
    </PreviewCard>
  );
}

// ==================== Blok düzenleyici (sol panel) ====================

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
  const hasConfig = block.type === "heading" || block.type === "text" || block.type === "subtopicScan" || block.type === "trend" || block.type === "history";

  return (
    <div className="rounded-xl border border-hairline bg-white/60 p-3 dark:border-white/10 dark:bg-midnight-card/40">
      <div className="flex items-center gap-2">
        <meta.icon className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
        <span className="flex-1 truncate text-[13px] font-semibold text-espresso dark:text-cream">{meta.label}</span>
        <button onClick={() => onMove(-1)} disabled={index === 0} className="text-espresso-muted transition hover:text-espresso disabled:opacity-30 dark:text-cream/40">
          <ChevronUp className="h-4 w-4" />
        </button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} className="text-espresso-muted transition hover:text-espresso disabled:opacity-30 dark:text-cream/40">
          <ChevronDown className="h-4 w-4" />
        </button>
        <button onClick={onRemove} className="text-espresso-muted transition hover:text-rose-600 dark:text-cream/40">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {hasConfig && block.type === "heading" && (
        <input
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<LocalBlock>)}
          placeholder="Başlık metni"
          className="mt-2.5 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-[13px] text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        />
      )}

      {hasConfig && block.type === "text" && (
        <textarea
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<LocalBlock>)}
          placeholder="Serbest metin..."
          rows={4}
          className="mt-2.5 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-[13px] text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        />
      )}

      {hasConfig && (block.type === "trend" || block.type === "history") && (
        <div className="mt-2.5 flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-[10px] text-espresso-muted dark:text-cream/40">Başlangıç</label>
            <input
              type="date"
              value={block.from ?? ""}
              onChange={(e) => onChange({ from: e.target.value || null } as Partial<LocalBlock>)}
              className="w-full rounded-lg border border-hairline bg-white px-2.5 py-2 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-[10px] text-espresso-muted dark:text-cream/40">Bitiş</label>
            <input
              type="date"
              value={block.to ?? ""}
              onChange={(e) => onChange({ to: e.target.value || null } as Partial<LocalBlock>)}
              className="w-full rounded-lg border border-hairline bg-white px-2.5 py-2 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
          </div>
        </div>
      )}

      {hasConfig && (block.type === "subtopicScan" || block.type === "history") && (
        <div className="mt-2.5 max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-hairline bg-white/50 p-2 dark:border-white/10 dark:bg-white/5">
          <label className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[12px] font-medium text-espresso hover:bg-cream-card dark:text-cream dark:hover:bg-white/5">
            <input type="checkbox" checked={block.subtopicIds === null} onChange={(e) => onChange({ subtopicIds: e.target.checked ? null : [] } as Partial<LocalBlock>)} />
            Tüm konular
          </label>
          {block.subtopicIds !== null &&
            subtopicOptions.map((opt) => (
              <label key={opt.subtopicId} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[12px] text-espresso hover:bg-cream-card dark:text-cream dark:hover:bg-white/5">
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
