"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pause, Play, ShieldCheck, AlertOctagon, ChevronDown, ChevronUp } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Finding = {
  id: string;
  testId: string;
  unitId: string;
  soruNo: number;
  kazanimId: string;
  category: string;
  severity: string;
  summary: string;
  beforePrompt: string;
  beforeCorrectAnswer: string;
  beforeSolution: string;
  beforeChecks: string;
  afterPrompt: string | null;
  afterCorrectAnswer: string | null;
  afterSolution: string | null;
  afterChecks: string | null;
  status: string;
  relatedFindingId: string | null;
  createdAt: string;
};

type ActivityEntry = { id: string; level: "info" | "found" | "fixed" | "manual" | "error"; message: string; createdAt: string };

type StatusResponse = {
  control: { paused: boolean };
  progress: { totalQuestions: number; reviewedQuestions: number; percent: number; totalRounds: number; reviewedRounds: number; remainingRounds: number; tokensUsed: number };
  summary: { totalFindings: number; needsManualFix: number; byCategory: Record<string, number>; bySeverity: Record<string, number> };
  findings: Finding[];
  nextCursor: string | null;
  activity: ActivityEntry[];
};

const ACTIVITY_LEVEL_CLASS: Record<ActivityEntry["level"], string> = {
  info: "text-espresso-muted dark:text-cream/40",
  found: "text-amber-700 dark:text-amber-300",
  fixed: "text-emerald-700 dark:text-emerald-300",
  manual: "text-rose-700 dark:text-rose-300",
  error: "text-rose-700 dark:text-rose-300",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.round(diffMs / 1000));
  if (s < 60) return `${s}sn önce`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}dk önce`;
  const h = Math.round(m / 60);
  return `${h}sa önce`;
}

const CATEGORY_LABEL: Record<string, string> = {
  "hesap-hatasi": "Hesap Hatası",
  yazim: "Yazım",
  mufredat: "Müfredat",
  "olcme-degerlendirme": "Ölçme-Değerlendirme",
  "tani-notu-uyumsuz": "Tanı Notu Uyumsuz",
  diger: "Diğer",
};

const SEVERITY_META: Record<string, { label: string; className: string }> = {
  kritik: { label: "Kritik", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  orta: { label: "Orta", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  dusuk: { label: "Düşük", className: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
};

function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  const severityMeta = SEVERITY_META[finding.severity] ?? SEVERITY_META.orta;
  const changed = finding.afterPrompt !== null;

  return (
    <div className="rounded-lg border border-hairline bg-white/50 px-3 py-2.5 dark:border-white/10 dark:bg-midnight-card/40">
      <button onClick={() => setExpanded((e) => !e)} className="flex w-full items-start justify-between gap-2 text-left">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", severityMeta.className)}>{severityMeta.label}</span>
            <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-medium text-brand-700 dark:text-brand-300">{CATEGORY_LABEL[finding.category] ?? finding.category}</span>
            <span className="font-mono text-[10px] text-espresso-muted dark:text-cream/40">
              {finding.testId} · #{finding.soruNo}
            </span>
            {finding.status === "fix-failed" && <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">elle düzeltilmeli</span>}
          </div>
          <p className="text-[12px] leading-snug text-espresso dark:text-cream">{finding.summary}</p>
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-espresso-muted" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-espresso-muted" />}
      </button>

      {expanded && (
        <div className="mt-2.5 space-y-2 border-t border-hairline pt-2.5 dark:border-white/10">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">Önce</p>
            <div className="space-y-1 rounded-lg bg-rose-500/5 p-2 text-[11px] leading-relaxed text-espresso dark:text-cream/80">
              <p>
                <span className="font-semibold">Soru:</span> {finding.beforePrompt}
              </p>
              <p>
                <span className="font-semibold">Cevap:</span> {finding.beforeCorrectAnswer}
              </p>
              <p>
                <span className="font-semibold">Tanı:</span> {finding.beforeChecks}
              </p>
            </div>
          </div>
          {changed ? (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Sonra (düzeltildi)</p>
              <div className="space-y-1 rounded-lg bg-emerald-500/5 p-2 text-[11px] leading-relaxed text-espresso dark:text-cream/80">
                <p>
                  <span className="font-semibold">Soru:</span> {finding.afterPrompt}
                </p>
                <p>
                  <span className="font-semibold">Cevap:</span> {finding.afterCorrectAnswer}
                </p>
                <p>
                  <span className="font-semibold">Tanı:</span> {finding.afterChecks}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] italic text-espresso-muted dark:text-cream/40">Otomatik düzeltme başarısız oldu — bu soru hâlâ eski (hatalı) hâliyle yayında, elle bakılmalı.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Faz C — arka plan QA denetim worker'ının (scripts/xray-qa-review.ts) DB'ye
// yazdığı durumu izleyen SALT OKUNUR panel + Duraklat/Devam Et. Worker
// Vercel'de DEĞİL ayrı bir arka plan sürecinde çalıştığı için bu panel onu
// TETİKLEMEZ — sadece durumunu gösterir (bkz. xray-pool-generation-
// dashboard.tsx ile AYNI desen).
export function XrayQaReviewDashboard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { showError } = useToast();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [extraFindings, setExtraFindings] = useState<Finding[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/xray-qa-review");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      setData(json);
      setExtraFindings([]);
    } catch {
      showError("QA denetim durumu yüklenemedi.");
    }
  }, [showError]);

  useEffect(() => {
    if (!isOpen) return;
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [isOpen, load]);

  async function postAction(action: "pause" | "resume") {
    setIsToggling(true);
    try {
      const res = await fetch("/api/platform/xray-qa-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      await load();
    } catch {
      showError("Durum değiştirilemedi.");
    } finally {
      setIsToggling(false);
    }
  }

  async function loadMore() {
    if (!data?.nextCursor) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/platform/xray-qa-review?cursor=${data.nextCursor}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      setExtraFindings((prev) => [...prev, ...json.findings]);
      setData((prev) => (prev ? { ...prev, nextCursor: json.nextCursor } : prev));
    } catch {
      showError("Daha fazla bulgu yüklenemedi.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  const allFindings = data ? [...data.findings, ...extraFindings] : [];
  const visibleFindings = severityFilter ? allFindings.filter((f) => f.severity === severityFilter) : allFindings;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Soru Havuzu QA Denetim Paneli" variant="center" widthClassName="max-w-3xl">
      {!data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">
            Zaten üretilmiş soru havuzunu, bağımsız bir AI geçişiyle ikinci kez denetler: hesap doğruluğu, yazım, müfredat uygunluğu, ölçme-değerlendirme kalitesi ve tanı notu (diagnosticComment) tutarlılığı. Bulunan her sorun otomatik
            düzeltilmeye çalışılır, düzeltilemeyenler &quot;elle düzeltilmeli&quot; olarak işaretlenir.
          </p>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-medium text-espresso dark:text-cream">
                İlerleme — {data.progress.reviewedQuestions.toLocaleString("tr-TR")}/{data.progress.totalQuestions.toLocaleString("tr-TR")} soru
              </span>
              <span className="font-mono text-espresso-muted dark:text-cream/40">%{data.progress.percent}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${data.progress.percent}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-espresso-muted dark:text-cream/40">
              {data.progress.reviewedRounds}/{data.progress.totalRounds} tur denetlendi · {data.progress.remainingRounds} tur kaldı
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-espresso dark:text-cream">Canlı Akış {!data.control.paused && <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 align-middle" />}</p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-cream-card p-2.5 font-mono text-[11px] leading-relaxed dark:bg-white/5">
              {data.activity.length === 0 ? (
                <p className="text-espresso-muted dark:text-cream/40">Henüz aktivite yok.</p>
              ) : (
                data.activity.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-2">
                    <span className={ACTIVITY_LEVEL_CLASS[a.level]}>{a.message}</span>
                    <span className="shrink-0 text-espresso-muted/70 dark:text-cream/30">{timeAgo(a.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-cream-card p-3 text-center dark:bg-white/5">
              <p className="text-lg font-bold text-espresso dark:text-cream">{data.summary.totalFindings}</p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Toplam Bulgu</p>
            </div>
            <div className="rounded-xl bg-cream-card p-3 text-center dark:bg-white/5">
              <p className={cn("text-lg font-bold", data.summary.needsManualFix > 0 ? "text-rose-600 dark:text-rose-400" : "text-espresso dark:text-cream")}>{data.summary.needsManualFix}</p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Elle Düzeltilmeli</p>
            </div>
            <div className="rounded-xl bg-cream-card p-3 text-center dark:bg-white/5">
              <p className="text-lg font-bold text-espresso dark:text-cream">{data.summary.byCategory["hesap-hatasi"] ?? 0}</p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Hesap Hatası</p>
            </div>
            <div className="rounded-xl bg-cream-card p-3 text-center dark:bg-white/5">
              <p className="text-lg font-bold text-espresso dark:text-cream">{(data.progress.tokensUsed / 1000).toFixed(0)}K</p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Kullanılan Token</p>
            </div>
          </div>

          <button
            onClick={() => postAction(data.control.paused ? "resume" : "pause")}
            disabled={isToggling}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50",
              !data.control.paused ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300" : "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
            )}
          >
            {isToggling ? <Loader2 className="h-4 w-4 animate-spin" /> : !data.control.paused ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {!data.control.paused ? "Denetim Çalışıyor — Durdur" : "Denetimi Başlat"}
          </button>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-espresso dark:text-cream">Bulgular</p>
              <div className="flex gap-1">
                {["kritik", "orta", "dusuk"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeverityFilter((prev) => (prev === s ? null : s))}
                    className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium transition", severityFilter === s ? SEVERITY_META[s].className : "bg-cream-card text-espresso-muted hover:text-espresso dark:bg-white/5 dark:text-cream/40")}
                  >
                    {SEVERITY_META[s].label} ({data.summary.bySeverity[s] ?? 0})
                  </button>
                ))}
              </div>
            </div>

            {visibleFindings.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-cream-card py-10 text-center dark:bg-white/5">
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
                <p className="text-[11px] text-espresso-muted dark:text-cream/40">{data.summary.totalFindings === 0 ? "Henüz bulgu yok." : "Bu filtrede bulgu yok."}</p>
              </div>
            ) : (
              <div className="max-h-[45vh] space-y-1.5 overflow-y-auto pr-1">
                {visibleFindings.map((f) => (
                  <FindingCard key={f.id} finding={f} />
                ))}
                {data.nextCursor && !severityFilter && (
                  <button onClick={loadMore} disabled={isLoadingMore} className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] text-brand-600 hover:underline dark:text-brand-400">
                    {isLoadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertOctagon className="h-3 w-3" />} Daha fazla göster
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
