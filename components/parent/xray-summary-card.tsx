"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Scan, MessageCircleHeart } from "lucide-react";
import { XRAY_SUBJECTS } from "@/lib/mock-data";
import { generateParentSummary } from "@/lib/xray-parent-summary";
import { MasterySparkline, type OverallTrendPoint } from "@/components/xray/mastery-trend-charts";
import { XrayPlacementProgressCard } from "@/components/xray/xray-placement-progress-card";
import { cn } from "@/lib/utils";

type SubtopicResult = { subtopicId: string; name: string; masteryScore: number | null };
type TopicResult = { topicName: string; subtopics: SubtopicResult[] };

function scoreColor(score: number | null): string {
  if (score === null) return "bg-cream-muted dark:bg-white/10";
  if (score >= 60) return "bg-emerald-500";
  if (score >= 30) return "bg-amber-500";
  return "bg-rose-500";
}

// Faz R — velinin Akademik Röntgen'i GÖREBİLECEĞİ İLK yüzey (önceden veli
// panelinde röntgen verisi HİÇ gösterilmiyordu). Kullanıcının açık isteği:
// kazanımId/yüzde tablosu yerine "Matematikte türev konusunda güçlü,
// integral konusunda desteğe ihtiyacı var" tarzı DOĞAL DİLDE bir not +
// şık grafikler — bu yüzden yöneticinin gördüğü teknik dökümün SADELEŞTİRİLMİŞ
// hali, ham veri değil.
export function XrayParentSummaryCard({ studentId }: { studentId: string }) {
  const [subject, setSubject] = useState(XRAY_SUBJECTS[0]);
  const [topics, setTopics] = useState<TopicResult[] | null>(null);
  const [trend, setTrend] = useState<OverallTrendPoint[] | null>(null);

  useEffect(() => {
    setTopics(null);
    fetch(`/api/xray/results/${encodeURIComponent(studentId)}?subject=${encodeURIComponent(subject)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setTopics(data.topics ?? []))
      .catch(() => setTopics([]));

    setTrend(null);
    fetch(`/api/xray/mastery-history/${encodeURIComponent(studentId)}?subject=${encodeURIComponent(subject)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setTrend(data.overallTrend ?? []))
      .catch(() => setTrend([]));
  }, [studentId, subject]);

  if (topics === null) return null;

  const allSubtopics = topics.flatMap((t) => t.subtopics);
  const tested = allSubtopics.filter((s) => s.masteryScore !== null);
  const summarySentence = generateParentSummary(subject, allSubtopics);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 rounded-2xl border border-hairline bg-white p-6 shadow-sm dark:border-white/5 dark:bg-midnight-card/50 dark:backdrop-blur-sm"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Scan className="h-4 w-4 text-brand-600" /> Akademik Röntgen
        </h2>
        {XRAY_SUBJECTS.length > 1 && (
          <select
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-brand-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            {XRAY_SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-xl bg-brand-500/5 p-3.5 text-sm leading-relaxed text-espresso dark:bg-brand-500/10 dark:text-cream">
        <MessageCircleHeart className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <span>{summarySentence}</span>
      </div>

      <div className="mb-4">
        <XrayPlacementProgressCard studentId={studentId} subject={subject} />
      </div>

      {trend && trend.length >= 2 && (
        <div className="mb-4">
          <MasterySparkline points={trend} />
        </div>
      )}

      {tested.length > 0 && (
        <div className="space-y-3">
          {topics
            .filter((topic) => topic.subtopics.some((s) => s.masteryScore !== null))
            .map((topic) => (
              <div key={topic.topicName}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">{topic.topicName}</p>
                <div className="space-y-2">
                  {topic.subtopics
                    .filter((s) => s.masteryScore !== null)
                    .map((sub) => (
                      <div key={sub.subtopicId}>
                        <div className="mb-1 flex items-center justify-between text-[11px]">
                          <span className="text-espresso-muted dark:text-cream/50">{sub.name}</span>
                          <span className="font-semibold text-espresso dark:text-cream">%{sub.masteryScore}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                          <motion.div
                            className={cn("h-full rounded-full", scoreColor(sub.masteryScore))}
                            initial={{ width: 0 }}
                            animate={{ width: `${sub.masteryScore}%` }}
                            transition={{ type: "spring", stiffness: 70, damping: 15 }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </motion.div>
  );
}
