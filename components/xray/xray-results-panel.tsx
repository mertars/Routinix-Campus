"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Scan, AlertCircle, CircleSlash, Download, Loader2 } from "lucide-react";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { useToast } from "@/lib/toast-context";
import { fetchAndDownloadPdf } from "@/lib/client/download-pdf";
import { AvatarInitials } from "@/components/principal/avatar-initials";
import { cn } from "@/lib/utils";

export type XrayRosterStudent = { id: string; firstName: string; lastName: string; branchName: string };

type SubtopicResult = { subtopicId: string; name: string; masteryScore: number | null; source: string | null; assessedAt: string | null };
type TopicResult = { topicName: string; grade: number; subtopics: SubtopicResult[] };
type ResultsResponse = { subject: string; topics: TopicResult[] };

const SUBJECTS = Object.keys(CURRICULUM_TREE);

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

// Akademik Röntgen — Faz 3: yönetici/öğretmen sonuç görselleştirme paneli.
// Hem /xray/principal (kurum geneli roster) hem /xray/teacher (öğretmenin
// KENDİ öğrencileri, bkz. çağıran taraftaki branchIds filtresi) TARAFINDAN
// paylaşılır — tek fark hangi roster'ın verildiği, gösterim mantığı AYNI.
export function XrayResultsPanel({ roster, defaultSubject }: { roster: XrayRosterStudent[]; defaultSubject?: string }) {
  const { showError } = useToast();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [subject, setSubject] = useState(defaultSubject && SUBJECTS.includes(defaultSubject) ? defaultSubject : SUBJECTS[0]);
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

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

  const selectedStudent = roster.find((s) => s.id === selectedId);
  const allSubtopics = results?.topics.flatMap((t) => t.subtopics) ?? [];
  const tested = allSubtopics.filter((s) => s.masteryScore !== null);
  const averageScore = tested.length === 0 ? null : Math.round(tested.reduce((sum, s) => sum + (s.masteryScore ?? 0), 0) / tested.length);

  if (roster.length === 0) {
    return <p className="text-xs text-espresso-muted dark:text-cream/40">Gösterilecek öğrenci bulunamadı.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Öğrenci ara..."
            className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-sm text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        >
          {filteredRoster.map((s) => (
            <option key={s.id} value={s.id}>
              {s.firstName} {s.lastName} — {s.branchName}
            </option>
          ))}
        </select>
        <select
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {selectedStudent && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-sky-500/20 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-sky-400/15 dark:bg-midnight-card/50"
        >
          <div className="mb-4 flex items-center gap-3">
            <AvatarInitials name={`${selectedStudent.firstName} ${selectedStudent.lastName}`} className="h-11 w-11 text-base" />
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
                <Scan className="h-4 w-4 text-sky-600 dark:text-sky-400" /> {selectedStudent.firstName} {selectedStudent.lastName}
              </h2>
              <p className="text-xs text-espresso-muted dark:text-cream/40">
                {selectedStudent.branchName} · {subject}
              </p>
            </div>
            {averageScore !== null && (
              <div className="ml-auto flex items-center gap-2">
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
              </div>
            )}
          </div>

          {loading && <p className="text-xs text-espresso-muted dark:text-cream/40">Yükleniyor...</p>}

          {!loading && results && tested.length === 0 && (
            <div className="flex items-center gap-2 rounded-2xl bg-cream-card p-4 text-xs text-espresso-muted dark:bg-white/5 dark:text-cream/40">
              <CircleSlash className="h-4 w-4 shrink-0" /> Bu öğrenci {subject} dersinde henüz röntgen testine girmedi.
            </div>
          )}

          {!loading && results && tested.length > 0 && (
            <div className="space-y-4">
              {results.topics
                .filter((topic) => topic.subtopics.length > 0)
                .map((topic) => (
                  <div key={topic.topicName}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
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
              {tested.some((s) => (s.masteryScore ?? 100) < 30) && (
                <div className="flex items-start gap-2 rounded-2xl bg-rose-50 p-3.5 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Kırmızı konularda temelden eksik tespit edildi — önceliklendirilmiş bir tekrar programı önerilir.</span>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
