"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Scan, AlertCircle, CircleSlash, Download, Loader2, Gauge, ListChecks, Flame, CalendarClock, LineChart, Users } from "lucide-react";
import { XRAY_SUBJECTS } from "@/lib/mock-data";
import { useToast } from "@/lib/toast-context";
import { fetchAndDownloadPdf } from "@/lib/client/download-pdf";
import { AvatarInitials } from "@/components/principal/avatar-initials";
import { XrayAssignmentSection } from "@/components/xray/xray-assignment-section";
import { XrayPracticeAssignmentSection } from "@/components/xray/xray-practice-assignment-section";
import { MasterySparkline, MasteryTrendDrilldown, type MasteryHistoryResponse } from "@/components/xray/mastery-trend-charts";
import { XraySetGoalButton } from "@/components/xray/xray-set-goal-button";
import { cn } from "@/lib/utils";

export type XrayRosterStudent = { id: string; firstName: string; lastName: string; branchName: string; branchId: string; grade: number };

type SubtopicResult = { subtopicId: string; name: string; masteryScore: number | null; source: string | null; assessedAt: string | null };
type TopicResult = { topicName: string; grade: number; subtopics: SubtopicResult[] };
type ResultsResponse = { subject: string; topics: TopicResult[] };

const SUBJECTS = XRAY_SUBJECTS;

function scoreColor(score: number | null): string {
  if (score === null) return "bg-cream-muted dark:bg-white/10";
  if (score >= 60) return "bg-emerald-500";
  if (score >= 30) return "bg-amber-500";
  return "bg-rose-500";
}

function scoreTextColor(score: number | null): string {
  if (score === null) return "text-espresso-muted dark:text-cream/30";
  if (score >= 60) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 30) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Gauge; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-white/70 p-3.5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
      <div className="mb-1.5 flex items-center gap-1.5 text-espresso-muted dark:text-cream/40">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn("text-lg font-bold text-espresso dark:text-cream", tone)}>{value}</p>
    </div>
  );
}

// Akademik Röntgen — Faz 3 (yönetici/öğretmen sonuç görselleştirme paneli),
// Faz I'de tam-ekran 3'lü sütun düzenine yükseltildi: sol = öğrenci
// listesi/arama, orta = seçili öğrencinin analiz kartı + konu dökümü, sağ =
// (SADECE canAssign, yani /xray/principal'da) her iki test türünün atama
// panelleri. Hem /xray/principal (kurum geneli roster) hem /xray/teacher
// (öğretmenin KENDİ öğrencileri) TARAFINDAN paylaşılır — /xray/teacher'da
// canAssign=false olduğu için sağ sütun hiç render edilmez, orta sütun daha
// geniş kalır.
export function XrayResultsPanel({
  roster,
  defaultSubject,
  canAssign = false,
}: {
  roster: XrayRosterStudent[];
  defaultSubject?: string;
  canAssign?: boolean;
}) {
  const { showError } = useToast();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [subject, setSubject] = useState(defaultSubject && SUBJECTS.includes(defaultSubject) ? defaultSubject : SUBJECTS[0]);
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingBranch, setDownloadingBranch] = useState(false);
  const [history, setHistory] = useState<MasteryHistoryResponse | null>(null);
  const [trendOpen, setTrendOpen] = useState(false);
  const [netTrend, setNetTrend] = useState<{ examLabel: string; net: number }[] | null>(null);

  useEffect(() => {
    setSelectedId((current) => current || roster[0]?.id || "");
  }, [roster]);

  const filteredRoster = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return roster;
    return roster.filter((s) => `${s.firstName} ${s.lastName}`.toLocaleLowerCase("tr-TR").includes(q));
  }, [roster, query]);

  useEffect(() => {
    if (!selectedId || !subject) return;
    setLoading(true);
    setResults(null);
    fetch(`/api/xray/results/${encodeURIComponent(selectedId)}?subject=${encodeURIComponent(subject)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setResults(data))
      .catch(() => showError("Röntgen sonucu yüklenemedi."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, subject]);

  useEffect(() => {
    if (!selectedId || !subject) return;
    setHistory(null);
    fetch(`/api/xray/mastery-history/${encodeURIComponent(selectedId)}?subject=${encodeURIComponent(subject)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setHistory(data))
      .catch(() => {});
  }, [selectedId, subject]);

  useEffect(() => {
    if (!selectedId) return;
    setNetTrend(null);
    fetch(`/api/students/${encodeURIComponent(selectedId)}/net-summary`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setNetTrend(data.trendBySubject?.[subject] ?? []))
      .catch(() => {});
  }, [selectedId, subject]);

  async function downloadReport() {
    if (!selectedStudent) return;
    setDownloading(true);
    try {
      await fetchAndDownloadPdf(
        `/api/xray/report/${encodeURIComponent(selectedId)}?subject=${encodeURIComponent(subject)}`,
        undefined,
        `${selectedStudent.firstName}-${selectedStudent.lastName}-rontgen-raporu.pdf`.replace(/\s+/g, "-")
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "Rapor oluşturulamadı.");
    } finally {
      setDownloading(false);
    }
  }

  async function downloadBranchReport() {
    if (!selectedStudent) return;
    setDownloadingBranch(true);
    try {
      await fetchAndDownloadPdf(
        `/api/xray/branch-report?branchId=${encodeURIComponent(selectedStudent.branchId)}&subject=${encodeURIComponent(subject)}`,
        undefined,
        `${selectedStudent.branchName}-veli-toplantisi-raporu.pdf`.replace(/\s+/g, "-")
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "Rapor oluşturulamadı.");
    } finally {
      setDownloadingBranch(false);
    }
  }

  const selectedStudent = roster.find((s) => s.id === selectedId);
  const allSubtopics = results?.topics.flatMap((t) => t.subtopics) ?? [];
  const tested = allSubtopics.filter((s) => s.masteryScore !== null);
  const averageScore = tested.length === 0 ? null : Math.round(tested.reduce((sum, s) => sum + (s.masteryScore ?? 0), 0) / tested.length);
  const redZoneCount = tested.filter((s) => (s.masteryScore ?? 100) < 30).length;
  const lastAssessedAt = tested.reduce<string | null>((latest, s) => {
    if (!s.assessedAt) return latest;
    if (!latest || s.assessedAt > latest) return s.assessedAt;
    return latest;
  }, null);

  // Faz O — deneme net'i ile röntgen skoru çapraz analizi: "gerçek bir
  // korelasyon katsayısı" hesaplamak için genelde yeterli veri noktası
  // olmuyor (bir öğrencinin birkaç denemesi olur) — bunun yerine BASİT,
  // savunulabilir bir eşleştirme: bu derste net SON DENEMEDE düştü VE bu
  // derste kırmızı bölgede (skor<30) konu VARSA, ikisini birlikte göster.
  const netDropping = netTrend !== null && netTrend.length >= 2 && netTrend[netTrend.length - 1].net < netTrend[netTrend.length - 2].net;
  const redZoneSubtopics = tested.filter((s) => (s.masteryScore ?? 100) < 30).map((s) => s.name);
  const showCrossInsight = netDropping && redZoneSubtopics.length > 0;

  if (roster.length === 0) {
    return <p className="text-xs text-espresso-muted dark:text-cream/40">Gösterilecek öğrenci bulunamadı.</p>;
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6">
      <div className={cn("grid gap-4", canAssign ? "lg:grid-cols-[280px_1fr_380px]" : "lg:grid-cols-[280px_1fr]")}>
        {/* SOL — öğrenci listesi/arama */}
        <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Öğrenci ara..."
              className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-sm text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
          </div>
          <select
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto rounded-2xl border border-hairline bg-white/70 p-1.5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 lg:max-h-[calc(100vh-14rem)]">
            {filteredRoster.length === 0 && (
              <p className="px-2.5 py-3 text-xs text-espresso-muted dark:text-cream/40">Eşleşen öğrenci yok.</p>
            )}
            {filteredRoster.map((s) => {
              const isActive = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                    isActive ? "bg-sky-500/15 dark:bg-sky-400/10" : "hover:bg-cream-card dark:hover:bg-white/5"
                  )}
                >
                  <AvatarInitials name={`${s.firstName} ${s.lastName}`} className="h-8 w-8 shrink-0 text-xs" />
                  <div className="min-w-0">
                    <p className={cn("truncate text-xs font-medium", isActive ? "text-sky-700 dark:text-sky-300" : "text-espresso dark:text-cream")}>
                      {s.firstName} {s.lastName}
                    </p>
                    <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">{s.branchName}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ORTA — analiz kartı + konu dökümü */}
        <div className="min-w-0 space-y-4">
          {selectedStudent && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-sky-500/20 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-sky-400/15 dark:bg-midnight-card/50"
              >
                <div className="flex items-center gap-3">
                  <AvatarInitials name={`${selectedStudent.firstName} ${selectedStudent.lastName}`} className="h-11 w-11 shrink-0 text-base" />
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-1.5 truncate text-sm font-semibold text-espresso dark:text-cream">
                      <Scan className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" /> <span className="truncate">{selectedStudent.firstName} {selectedStudent.lastName}</span>
                    </h2>
                    <p className="truncate text-xs text-espresso-muted dark:text-cream/40">
                      {selectedStudent.branchName} · {subject}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={downloadBranchReport}
                      disabled={downloadingBranch}
                      aria-label="Veli toplantısı raporunu indir (tüm şube)"
                      title="Veli toplantısı raporu (tüm şube)"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-500/25 bg-sky-500/10 text-sky-600 transition hover:bg-sky-500/20 disabled:opacity-60 dark:text-sky-300"
                    >
                      {downloadingBranch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                    </button>
                    <XraySetGoalButton studentId={selectedId} studentName={`${selectedStudent.firstName} ${selectedStudent.lastName}`} subject={subject} />
                    {averageScore !== null && (
                      <>
                      <button
                        onClick={downloadReport}
                        disabled={downloading}
                        aria-label="Röntgen raporunu indir"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-500/25 bg-sky-500/10 text-sky-600 transition hover:bg-sky-500/20 disabled:opacity-60 dark:text-sky-300"
                      >
                        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </button>
                      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sm font-bold", scoreTextColor(averageScore))}>
                        %{averageScore}
                      </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>

              {loading && <p className="text-xs text-espresso-muted dark:text-cream/40">Yükleniyor...</p>}

              {!loading && results && tested.length === 0 && (
                <div className="flex items-center gap-2 rounded-2xl bg-cream-card p-4 text-xs text-espresso-muted dark:bg-white/5 dark:text-cream/40">
                  <CircleSlash className="h-4 w-4 shrink-0" /> Bu öğrenci {subject} dersinde henüz röntgen testine girmedi.
                </div>
              )}

              {!loading && results && tested.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <StatCard icon={Gauge} label="Ortalama" value={`%${averageScore}`} tone={scoreTextColor(averageScore)} />
                    <StatCard icon={ListChecks} label="Test Edilen Konu" value={`${tested.length} / ${allSubtopics.length}`} />
                    <StatCard icon={Flame} label="Kırmızı Bölge" value={`${redZoneCount}`} tone={redZoneCount > 0 ? "text-rose-600 dark:text-rose-400" : undefined} />
                    <StatCard
                      icon={CalendarClock}
                      label="Son Değerlendirme"
                      value={lastAssessedAt ? new Date(lastAssessedAt).toLocaleDateString("tr-TR") : "—"}
                    />
                  </div>

                  {history && history.overallTrend.length >= 2 && (
                    <MasterySparkline points={history.overallTrend} onClick={() => setTrendOpen(true)} />
                  )}

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {results.topics
                      .filter((topic) => topic.subtopics.length > 0)
                      .map((topic) => (
                        <div
                          key={topic.topicName}
                          className="rounded-2xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50"
                        >
                          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                            {topic.topicName} · {topic.grade}. Sınıf
                          </p>
                          <div className="space-y-2.5">
                            {topic.subtopics.map((sub) => (
                              <div key={sub.subtopicId}>
                                <div className="mb-1 flex items-center justify-between text-[11px]">
                                  <span className="text-espresso-muted dark:text-cream/50">{sub.name}</span>
                                  <span className={cn("font-semibold", scoreTextColor(sub.masteryScore))}>
                                    {sub.masteryScore === null ? "Test edilmedi" : `%${sub.masteryScore}`}
                                  </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                                  <motion.div
                                    className={cn("h-full rounded-full", scoreColor(sub.masteryScore))}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${sub.masteryScore ?? 4}%` }}
                                    transition={{ type: "spring", stiffness: 70, damping: 15 }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>

                  {redZoneCount > 0 && (
                    <div className="flex items-start gap-2 rounded-2xl bg-rose-50 p-3.5 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>Kırmızı konularda temelden eksik tespit edildi — önceliklendirilmiş bir tekrar programı önerilir.</span>
                    </div>
                  )}

                  {showCrossInsight && (
                    <div className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                      <LineChart className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        {subject} netinde son denemede düşüş var — bu düşüş, kırmızı bölgedeki <strong>{redZoneSubtopics.join(", ")}</strong> konu(lar)ındaki
                        eksiklerle örtüşüyor olabilir.
                      </span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* SAĞ — test atama panelleri (SADECE yönetici) */}
        {canAssign && selectedStudent && (
          <div className="space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
            <XrayPracticeAssignmentSection
              studentId={selectedId}
              studentName={`${selectedStudent.firstName} ${selectedStudent.lastName}`}
              branchId={selectedStudent.branchId}
              branchName={selectedStudent.branchName}
              grade={selectedStudent.grade}
              subject={subject}
            />
            <XrayAssignmentSection
              studentId={selectedId}
              studentName={`${selectedStudent.firstName} ${selectedStudent.lastName}`}
              branchId={selectedStudent.branchId}
              branchName={selectedStudent.branchName}
              grade={selectedStudent.grade}
              subject={subject}
            />
          </div>
        )}
      </div>

      <MasteryTrendDrilldown isOpen={trendOpen} onClose={() => setTrendOpen(false)} data={history} />
    </div>
  );
}
