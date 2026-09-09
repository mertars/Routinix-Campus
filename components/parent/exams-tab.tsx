"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Loader2, Medal } from "lucide-react";

type ExamRow = {
  examId: string;
  examName: string;
  examDate: string;
  totalNet: number;
  subjects: { subject: string; net: number }[];
};
type Payload = {
  targetNet: number | null;
  actualNet: number | null;
  examBreakdown: ExamRow[];
  branchRank: number | null;
  institutionRank: number | null;
  estimatedNationwidePercentile: number | null;
};

// Veli, çocuğunun deneme sonuçlarını göremiyordu — oysa uç
// (/api/students/[id]/net-summary) veliye AÇIKTI ve ders bazlı trend,
// şube sırası, kurum sırası ve ülke yüzdeliğini zaten hesaplıyordu.
// Panelde onu okuyan hiçbir ekran yoktu.
export function ParentExamsTab({ studentId }: { studentId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/students/${studentId}/net-summary`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!data || data.examBreakdown.length === 0) {
    return (
      <p className="rounded-2xl border border-hairline bg-white p-8 text-center text-sm text-espresso-muted dark:border-white/5 dark:bg-midnight-card/50 dark:text-cream/40">
        Henüz deneme sonucu yok.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Box label="Güncel net" value={data.actualNet?.toFixed(2) ?? "—"} />
        <Box label="Hedef net" value={data.targetNet?.toFixed(2) ?? "—"} />
        <Box label="Şube sırası" value={data.branchRank ? `${data.branchRank}.` : "—"} />
        <Box label="Kurum sırası" value={data.institutionRank ? `${data.institutionRank}.` : "—"} />
      </div>

      {data.estimatedNationwidePercentile !== null && (
        <div className="flex items-center gap-2 rounded-2xl border border-brand-500/25 bg-brand-500/5 p-4">
          <Medal className="h-4 w-4 shrink-0 text-brand-600" />
          <p className="text-xs text-espresso dark:text-cream">
            Tahmini ülke yüzdeliği: <span className="font-semibold">%{data.estimatedNationwidePercentile}</span>
            <span className="ml-1 text-espresso-muted dark:text-cream/40">
              — kurum içi sonuçlardan yapılan bir tahmindir, resmî sıralama değildir.
            </span>
          </p>
        </div>
      )}

      <div className="space-y-2">
        {data.examBreakdown.map((e) => (
          <div key={e.examId} className="rounded-xl border border-hairline bg-white p-3 dark:border-white/5 dark:bg-midnight-card/50">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-espresso dark:text-cream">
                <TrendingUp className="h-3.5 w-3.5 text-brand-600" />
                {e.examName}
              </span>
              <span className="text-sm font-bold text-espresso dark:text-cream">{e.totalNet.toFixed(2)} net</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {e.subjects.map((s) => (
                <span
                  key={s.subject}
                  className="rounded-lg bg-cream-card px-2 py-1 text-[11px] text-espresso dark:bg-white/5 dark:text-cream"
                >
                  {s.subject}: <span className="font-semibold">{s.net.toFixed(2)}</span>
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-espresso-muted/70 dark:text-cream/30">
              {new Date(e.examDate).toLocaleDateString("tr-TR")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-white p-3 dark:border-white/5 dark:bg-midnight-card/50">
      <p className="text-[11px] text-espresso-muted dark:text-cream/40">{label}</p>
      <p className="text-xl font-bold text-espresso dark:text-cream">{value}</p>
    </div>
  );
}
