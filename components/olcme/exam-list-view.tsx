"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, Search, CalendarDays, Users, KeyRound, ScanLine, FileBarChart, Folder, ArrowLeft, FolderOpen } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { NewExamWizard } from "./new-exam-wizard";
import { type ExamListItem, formatExamDate } from "./types";

const UNCATEGORIZED_LABEL = "Kategorisiz";

function statusOf(exam: ExamListItem) {
  if (exam.studentCount > 0) return { label: "Sonuçlandı", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
  if (exam.answerKeySubjectCount > 0) return { label: "Sonuç bekliyor", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" };
  return { label: "Hazırlanıyor", className: "border-hairline bg-cream-card text-espresso-muted dark:border-white/10 dark:bg-white/5 dark:text-cream/40" };
}

// Deneme listesi iki katmanlı: önce KLASÖRLER (TYT, 8. Sınıf, …), içine
// girince o klasörün denemeleri. Kullanıcı talebi — denemeler düz bir
// listede birikince (TYT'ler, sınıf seviyeleri hepsi bir arada) aranamaz
// hale geliyordu. Klasör = Exam.category (serbest metin, bkz. şema).
export function ExamListView({ onSelect }: { onSelect: (examId: string) => void }) {
  const { showError } = useToast();
  const [exams, setExams] = useState<ExamListItem[] | null>(null);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  function load() {
    return fetch("/api/exams")
      .then((res) => res.json())
      .then((data) => setExams(data.exams ?? []))
      .catch(() => showError("Denemeler yüklenemedi."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const folders = useMemo(() => {
    if (!exams) return [];
    const map = new Map<string, ExamListItem[]>();
    for (const e of exams) {
      const key = e.category ?? UNCATEGORIZED_LABEL;
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()]
      .map(([name, items]) => ({
        name,
        items,
        pendingCount: items.filter((i) => i.studentCount === 0).length,
        latestDate: items.reduce((max, i) => (i.examDate > max ? i.examDate : max), items[0].examDate),
      }))
      // "Kategorisiz" her zaman en sonda — asıl klasörler önce görünsün.
      .sort((a, b) =>
        a.name === UNCATEGORIZED_LABEL ? 1 : b.name === UNCATEGORIZED_LABEL ? -1 : a.name.localeCompare(b.name, "tr")
      );
  }, [exams]);

  const openFolderItems = useMemo(() => {
    if (!openCategory) return [];
    const items = folders.find((f) => f.name === openCategory)?.items ?? [];
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return q ? items.filter((e) => e.name.toLocaleLowerCase("tr-TR").includes(q)) : items;
  }, [folders, openCategory, query]);

  const wizard = (
    <NewExamWizard
      isOpen={wizardOpen}
      onClose={() => setWizardOpen(false)}
      defaultCategory={openCategory && openCategory !== UNCATEGORIZED_LABEL ? openCategory : undefined}
      onCreated={async (newExamId) => {
        setWizardOpen(false);
        await load();
        onSelect(newExamId);
      }}
    />
  );

  // ---------- Klasör içi ----------
  if (openCategory) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-10">
        <button
          onClick={() => {
            setOpenCategory(null);
            setQuery("");
          }}
          className="mb-4 flex items-center gap-1.5 text-[11px] font-medium text-espresso-muted transition hover:text-espresso dark:text-cream/40 dark:hover:text-cream"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Tüm klasörler
        </button>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-espresso dark:text-cream">
              <FolderOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> {openCategory}
            </h1>
            <p className="mt-1 text-xs text-espresso-muted dark:text-cream/40">{openFolderItems.length} deneme</p>
          </div>
          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" /> Yeni Deneme
          </button>
        </div>

        <div className="relative mb-5 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bu klasörde ara..."
            className="w-full rounded-xl border border-hairline bg-white/70 py-2.5 pl-8 pr-3 text-xs text-espresso outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {openFolderItems.map((exam, i) => {
            const status = statusOf(exam);
            return (
              <motion.button
                key={exam.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                onClick={() => onSelect(exam.id)}
                className="group flex flex-col gap-3 rounded-2xl border border-hairline bg-white/70 p-4 text-left shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-emerald-400/40 hover:shadow-md dark:border-white/10 dark:bg-midnight-card/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-sm font-semibold leading-snug text-espresso dark:text-cream">{exam.name}</span>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold", status.className)}>{status.label}</span>
                </div>
                <span className="flex items-center gap-1.5 text-[11px] text-espresso-muted dark:text-cream/40">
                  <CalendarDays className="h-3 w-3" /> {formatExamDate(exam.examDate)}
                </span>
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline pt-3 text-[10.5px] text-espresso-muted dark:border-white/10 dark:text-cream/40">
                  <span className="flex items-center gap-1">
                    <ScanLine className="h-3 w-3" /> {exam.subjectCount} ders
                  </span>
                  <span className={cn("flex items-center gap-1", exam.answerKeySubjectCount > 0 && "text-emerald-700 dark:text-emerald-400")}>
                    <KeyRound className="h-3 w-3" /> {exam.answerKeySubjectCount}/{exam.subjectCount}
                  </span>
                  <span className={cn("flex items-center gap-1", exam.studentCount > 0 && "text-emerald-700 dark:text-emerald-400")}>
                    <Users className="h-3 w-3" /> {exam.studentCount}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
        {wizard}
      </div>
    );
  }

  // ---------- Klasör listesi ----------
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-10">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-espresso dark:text-cream">Denemeler</h1>
          <p className="mt-1 text-xs text-espresso-muted dark:text-cream/40">
            Cevap anahtarını ve optik sonuç dosyasını yapıştır — netler, sıralamalar ve kazanım analizi otomatik çıksın.
          </p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" /> Yeni Deneme
        </button>
      </div>

      {exams === null ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : folders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-hairline bg-white/40 py-24 text-center dark:border-white/10 dark:bg-white/5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
            <FileBarChart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-espresso dark:text-cream">Henüz deneme yok</p>
          <p className="max-w-xs text-xs leading-relaxed text-espresso-muted dark:text-cream/40">
            İlk denemeni oluştur — bir kez optik şablonu tanımladıktan sonra sonraki denemeler saniyeler sürer.
          </p>
          <button
            onClick={() => setWizardOpen(true)}
            className="mt-1 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" /> Yeni Deneme
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {folders.map((folder, i) => (
            <motion.button
              key={folder.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
              onClick={() => setOpenCategory(folder.name)}
              className={cn(
                "group flex flex-col gap-3 rounded-2xl border p-4 text-left shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md",
                folder.name === UNCATEGORIZED_LABEL
                  ? "border-dashed border-hairline bg-white/40 hover:border-emerald-400/40 dark:border-white/15 dark:bg-white/5"
                  : "border-hairline bg-white/70 hover:border-emerald-400/40 dark:border-white/10 dark:bg-midnight-card/50"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 transition group-hover:bg-emerald-500/15">
                  <Folder className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </span>
                {folder.pendingCount > 0 && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9.5px] font-semibold text-amber-700 dark:text-amber-300">
                    {folder.pendingCount} bekliyor
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-espresso dark:text-cream">{folder.name}</p>
                <p className="mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">
                  {folder.items.length} deneme · son {formatExamDate(folder.latestDate)}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      )}
      {wizard}
    </div>
  );
}
