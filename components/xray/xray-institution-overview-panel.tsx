"use client";

import { useEffect, useState } from "react";
import { Loader2, ChevronRight, ChevronLeft, Building2, Users, Flame, Gauge, Download } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { XRAY_SUBJECTS } from "@/lib/mock-data";
import { useToast } from "@/lib/toast-context";
import { fetchAndDownloadPdf } from "@/lib/client/download-pdf";
import { cn } from "@/lib/utils";

type BranchOverview = { branchId: string; branchName: string; grade: number; studentCount: number; testedCount: number; average: number | null; redZoneCount: number };
type GradeOverview = { grade: number; studentCount: number; testedCount: number; average: number | null; redZoneCount: number; branches: BranchOverview[] };
type InstitutionOverviewResponse = { subject: string; studentCount: number; testedCount: number; average: number | null; redZoneCount: number; grades: GradeOverview[] };
type BranchDetail = {
  branchName: string;
  branchAverage: number;
  studentCount: number;
  testedCount: number;
  subtopicBreakdown: { subtopicId: string; name: string; average: number }[];
  students: { studentId: string; name: string; average: number | null; delta: number | null }[];
};

type Level = { kind: "institution" } | { kind: "grade"; grade: number } | { kind: "branch"; branchId: string; grade: number };

function scoreTone(score: number | null): string {
  if (score === null) return "text-espresso-muted dark:text-cream/30";
  if (score >= 60) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 30) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}
function scoreBar(score: number): string {
  if (score >= 60) return "bg-emerald-500";
  if (score >= 30) return "bg-amber-500";
  return "bg-rose-500";
}

function StatTile({ icon: Icon, label, value, tone }: { icon: typeof Gauge; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-white/70 p-3.5 dark:border-white/10 dark:bg-midnight-card/50">
      <div className="mb-1 flex items-center gap-1.5 text-espresso-muted dark:text-cream/40">
        <Icon className="h-3.5 w-3.5" /> <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn("text-lg font-bold text-espresso dark:text-cream", tone)}>{value}</p>
    </div>
  );
}

function SummaryRow({ summary }: { summary: { average: number | null; testedCount: number; studentCount: number; redZoneCount: number } }) {
  return (
    <div className="mb-4 grid grid-cols-3 gap-3">
      <StatTile icon={Gauge} label="Ortalama" value={summary.average === null ? "—" : `%${summary.average}`} tone={scoreTone(summary.average)} />
      <StatTile icon={Users} label="Test Edilen" value={`${summary.testedCount}/${summary.studentCount}`} />
      <StatTile
        icon={Flame}
        label="Kırmızı Bölge"
        value={`${summary.redZoneCount}`}
        tone={summary.redZoneCount > 0 ? "text-rose-600 dark:text-rose-400" : undefined}
      />
    </div>
  );
}

function DrilldownCard({
  label,
  average,
  testedCount,
  studentCount,
  redZoneCount,
  onClick,
}: {
  label: string;
  average: number | null;
  testedCount: number;
  studentCount: number;
  redZoneCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-2xl border border-hairline bg-white/70 p-4 text-left shadow-sm backdrop-blur-sm transition hover:border-sky-400/40 hover:shadow-md dark:border-white/10 dark:bg-midnight-card/50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-espresso dark:text-cream">{label}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-espresso-muted transition group-hover:translate-x-0.5 dark:text-cream/40" />
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className={cn("text-2xl font-bold", scoreTone(average))}>{average === null ? "—" : `%${average}`}</span>
        {redZoneCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
            <Flame className="h-3 w-3" /> {redZoneCount}
          </span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
        <div className={cn("h-full rounded-full", average === null ? "bg-cream-muted dark:bg-white/10" : scoreBar(average))} style={{ width: `${average ?? 4}%` }} />
      </div>
      <p className="text-[10px] text-espresso-muted dark:text-cream/40">
        {testedCount}/{studentCount} öğrenci test edildi
      </p>
    </button>
  );
}

// Kullanıcı talebi — "sistem tamamen öğrenci üstünden çalışıyor, genel
// sınıf/okul ekranı lazım": Kurum Geneli → Sınıf Seviyesi → Şube şeklinde
// üç katmanlı bir drill-down. Kurum+sınıf seviyeleri TEK istekte
// (/api/xray/institution-overview) gelir; bir şubeye tıklanınca ZATEN VAR
// OLAN /api/xray/branch-average ucu (bkz. XrayBranchAveragePanel) ikinci
// bir istekle çağrılır — konu bazlı kırılım/öğrenci listesini burada
// TEKRAR yazmak yerine aynı veri kaynağını yeniden kullanır.
export function XrayInstitutionOverviewPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { showError } = useToast();
  const [subject, setSubject] = useState(XRAY_SUBJECTS[0]);
  const [data, setData] = useState<InstitutionOverviewResponse | null>(null);
  const [level, setLevel] = useState<Level>({ kind: "institution" });
  const [branchDetail, setBranchDetail] = useState<BranchDetail | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLevel({ kind: "institution" });
    setData(null);
    fetch(`/api/xray/institution-overview?subject=${encodeURIComponent(subject)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((json) => setData(json))
      .catch(() => showError("Kurum istatistikleri yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, subject]);

  useEffect(() => {
    if (level.kind !== "branch") return;
    setBranchDetail(null);
    fetch(`/api/xray/branch-average?branchId=${encodeURIComponent(level.branchId)}&subject=${encodeURIComponent(subject)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((json) => setBranchDetail(json))
      .catch(() => showError("Şube detayı yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, subject]);

  const gradeData = level.kind !== "institution" && data ? data.grades.find((g) => g.grade === level.grade) : undefined;
  const branchMeta = level.kind === "branch" && gradeData ? gradeData.branches.find((b) => b.branchId === level.branchId) : undefined;

  // Kullanıcı talebi (2026-09-03) — "her yere pdf rapor çıkarma ekle okul
  // için sınıf seviyesi için şube için indirebilmeli": hangi katmandaysa
  // ONUN raporu iner. Kurum/sınıf seviyesi YENİ /api/xray/institution-
  // report ucunu (institution-overview'in AYNI sayılarını PDF'e döker),
  // şube ZATEN VAR OLAN /api/xray/branch-report'u kullanır (kod
  // tekrarı yok).
  async function downloadReport() {
    setDownloading(true);
    try {
      if (level.kind === "institution") {
        await fetchAndDownloadPdf(`/api/xray/institution-report?subject=${encodeURIComponent(subject)}`, undefined, `genel-bakis-kurum-geneli-${subject}.pdf`.replace(/\s+/g, "-"));
      } else if (level.kind === "grade") {
        await fetchAndDownloadPdf(
          `/api/xray/institution-report?subject=${encodeURIComponent(subject)}&grade=${level.grade}`,
          undefined,
          `genel-bakis-${level.grade}-sinif-${subject}.pdf`.replace(/\s+/g, "-")
        );
      } else if (branchMeta) {
        await fetchAndDownloadPdf(
          `/api/xray/branch-report?branchId=${encodeURIComponent(level.branchId)}&subject=${encodeURIComponent(subject)}`,
          undefined,
          `${branchMeta.branchName}-veli-toplantisi-raporu.pdf`.replace(/\s+/g, "-")
        );
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Rapor oluşturulamadı.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Genel Bakış" variant="center" widthClassName="max-w-3xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        {level.kind === "institution" ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
            <Building2 className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" /> Kurum Geneli
          </p>
        ) : (
          <button
            onClick={() => setLevel(level.kind === "branch" ? { kind: "grade", grade: level.grade } : { kind: "institution" })}
            className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> {level.kind === "branch" ? `${level.grade}. Sınıf` : "Kurum Geneli"}
          </button>
        )}
        <div className="flex items-center gap-1.5">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            {XRAY_SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {data && (level.kind !== "branch" || branchDetail) && (
            <button
              onClick={downloadReport}
              disabled={downloading}
              aria-label="PDF indir"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-700 transition hover:bg-sky-500/20 disabled:opacity-60 dark:text-sky-300"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {!data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
        </div>
      ) : level.kind === "institution" ? (
        data.grades.length === 0 ? (
          <p className="rounded-2xl bg-cream-card px-4 py-10 text-center text-xs text-espresso-muted dark:bg-white/5 dark:text-cream/40">
            Röntgen için uygun (9-12. sınıf) şube bulunamadı.
          </p>
        ) : (
          <>
            <SummaryRow summary={data} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.grades.map((g) => (
                <DrilldownCard
                  key={g.grade}
                  label={`${g.grade}. Sınıf`}
                  average={g.average}
                  testedCount={g.testedCount}
                  studentCount={g.studentCount}
                  redZoneCount={g.redZoneCount}
                  onClick={() => setLevel({ kind: "grade", grade: g.grade })}
                />
              ))}
            </div>
          </>
        )
      ) : level.kind === "grade" && gradeData ? (
        gradeData.branches.length === 0 ? (
          <p className="rounded-2xl bg-cream-card px-4 py-10 text-center text-xs text-espresso-muted dark:bg-white/5 dark:text-cream/40">Bu sınıf seviyesinde şube bulunamadı.</p>
        ) : (
          <>
            <SummaryRow summary={gradeData} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gradeData.branches.map((b) => (
                <DrilldownCard
                  key={b.branchId}
                  label={b.branchName}
                  average={b.average}
                  testedCount={b.testedCount}
                  studentCount={b.studentCount}
                  redZoneCount={b.redZoneCount}
                  onClick={() => setLevel({ kind: "branch", branchId: b.branchId, grade: b.grade })}
                />
              ))}
            </div>
          </>
        )
      ) : level.kind === "branch" ? (
        !branchDetail ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-2xl bg-cream-card p-4 dark:bg-white/5">
              <div className={cn("text-4xl font-bold", scoreTone(branchDetail.branchAverage))}>%{branchDetail.branchAverage}</div>
              <div className="text-[11px] text-espresso-muted dark:text-cream/40">
                <p className="font-semibold text-espresso dark:text-cream">{branchMeta?.branchName ?? branchDetail.branchName} ortalaması</p>
                <p className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {branchDetail.testedCount}/{branchDetail.studentCount} öğrenci test edildi
                </p>
              </div>
            </div>

            {branchDetail.subtopicBreakdown.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Konu Bazlı Şube Ortalaması</p>
                <div className="max-h-[26vh] space-y-2 overflow-y-auto pr-1">
                  {branchDetail.subtopicBreakdown.map((s) => (
                    <div key={s.subtopicId}>
                      <div className="mb-0.5 flex items-center justify-between text-[11px]">
                        <span className="text-espresso-muted dark:text-cream/50">{s.name}</span>
                        <span className={cn("font-semibold", scoreTone(s.average))}>%{s.average}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                        <div className={cn("h-full rounded-full", scoreBar(s.average))} style={{ width: `${s.average}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Öğrenciler</p>
              <div className="max-h-[26vh] space-y-1 overflow-y-auto pr-1">
                {[...branchDetail.students]
                  .sort((a, b) => a.name.localeCompare(b.name, "tr-TR"))
                  .map((s) => (
                    <div key={s.studentId} className="flex items-center justify-between rounded-lg bg-white/50 px-2.5 py-1.5 text-[11px] dark:bg-midnight-card/40">
                      <span className="text-espresso dark:text-cream">{s.name}</span>
                      {s.average === null ? (
                        <span className="text-espresso-muted/60 dark:text-cream/30">Test edilmedi</span>
                      ) : (
                        <span className={cn("font-semibold", scoreTone(s.average))}>
                          %{s.average}{" "}
                          {s.delta !== null && (
                            <span className="text-espresso-muted/70 dark:text-cream/30">
                              ({s.delta >= 0 ? "+" : ""}
                              {s.delta})
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )
      ) : null}
    </Modal>
  );
}
