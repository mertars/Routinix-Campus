"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, ArrowUpDown, Users, TrendingUp, Award, Target, Download } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import type { ExamResults } from "./types";

type SortKey = "rank" | "name" | "branch" | string;

// Rapor — modülün asıl çıktısı. Öğrenci başına ders ders net + toplam net
// + genel/şube sıralaması. Sıralama sunucuda hesaplanır (bkz.
// /api/exams/[id]/results) çünkü eşit netlerin AYNI sırayı alması
// (1,2,2,4) istemcide tekrar tekrar yapılacak bir iş değil.
export function ResultsTable({ examId }: { examId: string }) {
  const { showError } = useToast();
  const [data, setData] = useState<ExamResults | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    setData(null);
    fetch(`/api/exams/${examId}/results`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => showError("Sonuçlar yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLocaleLowerCase("tr-TR");
    const filtered = q
      ? data.students.filter((s) => `${s.firstName} ${s.lastName} ${s.branchName} ${s.studentNumber}`.toLocaleLowerCase("tr-TR").includes(q))
      : data.students;

    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "rank") return a.rank - b.rank;
      if (sortKey === "name") return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "tr");
      if (sortKey === "branch") return a.branchName.localeCompare(b.branchName, "tr") || a.rank - b.rank;
      const ai = data.subjects.indexOf(sortKey);
      if (ai < 0) return 0;
      return (b.subjects[ai]?.net ?? -Infinity) - (a.subjects[ai]?.net ?? -Infinity);
    });
    return sortAsc ? sorted : sorted.reverse();
  }, [data, query, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function exportCsv() {
    if (!data) return;
    const header = ["Sıra", "Öğrenci No", "Ad Soyad", "Şube", ...data.subjects, "Toplam Net"];
    const lines = data.students.map((s) => [
      s.rank,
      s.studentNumber,
      `${s.firstName} ${s.lastName}`,
      s.branchName,
      ...s.subjects.map((x) => (x ? x.net : "")),
      s.totalNet,
    ]);
    const csv = [header, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.exam.name.replace(/[^\w\sğüşöçıİĞÜŞÖÇ-]/gi, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!data) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (data.stats.studentCount === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline bg-white/40 py-16 text-center dark:border-white/10 dark:bg-white/5">
        <Target className="h-5 w-5 text-espresso-muted dark:text-cream/30" />
        <p className="text-xs font-semibold text-espresso dark:text-cream">Henüz sonuç yok</p>
        <p className="max-w-sm text-[11px] text-espresso-muted dark:text-cream/40">&quot;Sonuçları Yükle&quot; adımından optik dosyasını yükle.</p>
      </div>
    );
  }

  const stats = [
    { label: "Katılan", value: data.stats.studentCount, icon: Users, suffix: "öğrenci" },
    { label: "Ortalama", value: data.stats.averageNet, icon: TrendingUp, suffix: "net" },
    { label: "En yüksek", value: data.stats.highestNet, icon: Award, suffix: "net" },
    { label: "En düşük", value: data.stats.lowestNet, icon: Target, suffix: "net" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-hairline bg-white/70 p-3.5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
            <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">
              <s.icon className="h-3 w-3" /> {s.label}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-espresso dark:text-cream">
              {s.value}
              <span className="ml-1 text-[10.5px] font-medium text-espresso-muted dark:text-cream/40">{s.suffix}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Ders ortalamaları — zayıf dersi bir bakışta gör */}
      <div className="flex flex-wrap gap-2">
        {data.subjectStats.map((s) => (
          <span
            key={s.subject}
            className="flex items-baseline gap-1.5 rounded-full border border-hairline bg-white/60 px-3 py-1.5 text-[11px] dark:border-white/10 dark:bg-white/5"
          >
            <span className="font-medium text-espresso-muted dark:text-cream/40">{s.subject}</span>
            <span className="font-bold tabular-nums text-espresso dark:text-cream">{s.averageNet}</span>
            <span className="text-[10px] text-espresso-muted dark:text-cream/30">/ {s.questionCount}</span>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Öğrenci veya şube ara..."
            className="w-full rounded-xl border border-hairline bg-white/70 py-2.5 pl-8 pr-3 text-xs text-espresso outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream"
          />
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 rounded-xl border border-hairline bg-white/70 px-3 py-2.5 text-[11px] font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream dark:hover:bg-white/5"
        >
          <Download className="h-3.5 w-3.5" /> Excel&apos;e aktar
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-hairline bg-white/70 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
        <div className="max-h-[34rem] overflow-auto">
          <table className="w-full text-[11.5px]">
            <thead className="sticky top-0 z-10 bg-cream-card text-left text-[9.5px] uppercase tracking-wide text-espresso-muted dark:bg-midnight-card dark:text-cream/40">
              <tr>
                <th className="w-12 px-3 py-2.5">
                  <button onClick={() => toggleSort("rank")} className="flex items-center gap-1 font-semibold transition hover:text-espresso dark:hover:text-cream">
                    Sıra <ArrowUpDown className="h-2.5 w-2.5" />
                  </button>
                </th>
                <th className="px-3 py-2.5">
                  <button onClick={() => toggleSort("name")} className="flex items-center gap-1 font-semibold transition hover:text-espresso dark:hover:text-cream">
                    Öğrenci <ArrowUpDown className="h-2.5 w-2.5" />
                  </button>
                </th>
                <th className="px-3 py-2.5">
                  <button onClick={() => toggleSort("branch")} className="flex items-center gap-1 font-semibold transition hover:text-espresso dark:hover:text-cream">
                    Şube <ArrowUpDown className="h-2.5 w-2.5" />
                  </button>
                </th>
                {data.subjects.map((s) => (
                  <th key={s} className="whitespace-nowrap px-3 py-2.5 text-right">
                    <button onClick={() => toggleSort(s)} className="ml-auto flex items-center gap-1 font-semibold transition hover:text-espresso dark:hover:text-cream">
                      {s} <ArrowUpDown className="h-2.5 w-2.5" />
                    </button>
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-espresso dark:text-cream">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.studentId} className="border-t border-hairline transition hover:bg-emerald-500/[0.04] dark:border-white/10">
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-lg px-1.5 text-[10.5px] font-bold tabular-nums",
                        s.rank === 1
                          ? "bg-amber-400/20 text-amber-700 dark:text-amber-300"
                          : s.rank <= 3
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "text-espresso-muted dark:text-cream/40"
                      )}
                    >
                      {s.rank}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="block font-medium text-espresso dark:text-cream">
                      {s.firstName} {s.lastName}
                    </span>
                    <span className="block text-[10px] text-espresso-muted dark:text-cream/40">No: {s.studentNumber}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-espresso-muted dark:text-cream/50">
                    {s.branchName}
                    <span className="ml-1 text-[10px] opacity-60">({s.branchRank}.)</span>
                  </td>
                  {s.subjects.map((sub, i) => (
                    <td key={data.subjects[i]} className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {sub ? (
                        <>
                          <span className="font-semibold text-espresso dark:text-cream">{sub.net}</span>
                          <span className="ml-1 text-[9.5px] text-espresso-muted dark:text-cream/40">
                            {sub.correct}·{sub.wrong}·{sub.blank}
                          </span>
                        </>
                      ) : (
                        <span className="text-espresso-muted/50 dark:text-cream/20">—</span>
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{s.totalNet}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10.5px] text-espresso-muted dark:text-cream/40">
        Ders sütunlarındaki küçük sayılar sırasıyla doğru · yanlış · boş.
      </p>
    </div>
  );
}
