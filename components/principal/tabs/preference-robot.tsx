"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, ArrowUp, ArrowDown, Info, Wand2 } from "lucide-react";
import { UNIVERSITY_PROGRAMS, PREFERENCE_CATEGORY_LABEL, type PreferenceCategory, type UniversityProgram } from "@/lib/mock-data";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type StudentOption = { id: string; firstName: string; lastName: string; branchName: string };

const CATEGORY_STYLES: Record<PreferenceCategory, string> = {
  hayal: "border-rose-300 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10",
  ideal: "border-brand-400 bg-brand-50/60 dark:border-brand-500/30 dark:bg-brand-500/10",
  garanti: "border-green-300 bg-green-50/60 dark:border-green-500/30 dark:bg-green-500/10",
};

const CATEGORY_BADGE: Record<PreferenceCategory, string> = {
  hayal: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  ideal: "bg-brand-100 text-brand-700 dark:bg-brand-600/20 dark:text-brand-300",
  garanti: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
};

function categorize(program: UniversityProgram, ranking: number): PreferenceCategory {
  if (program.minRanking < ranking * 0.85) return "hayal";
  if (program.minRanking <= ranking * 1.15) return "ideal";
  return "garanti";
}

export function PreferenceRobotTab() {
  const { showError } = useToast();
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [ranking, setRanking] = useState(45000);
  const [preferenceList, setPreferenceList] = useState<UniversityProgram[]>([]);

  useEffect(() => {
    fetch("/api/admin/users/directory?role=STUDENT")
      .then((res) => res.json())
      .then((data) => {
        const students: StudentOption[] = data.students ?? [];
        setStudentOptions(students);
        setSelectedStudentId((current) => current || students[0]?.id || "");
      })
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedStudentId) return;
    fetch(`/api/preferences?studentId=${encodeURIComponent(selectedStudentId)}`)
      .then((res) => res.json())
      .then((data) => {
        const ids: string[] = data.programIds ?? [];
        setPreferenceList(ids.map((id) => UNIVERSITY_PROGRAMS.find((p) => p.id === id)).filter((p): p is UniversityProgram => !!p));
      })
      .catch(() => showError("Tercih listesi yüklenemedi."));
  }, [selectedStudentId, showError]);

  const student = studentOptions.find((row) => row.id === selectedStudentId);

  const grouped = useMemo(() => {
    const groups: Record<PreferenceCategory, UniversityProgram[]> = { hayal: [], ideal: [], garanti: [] };
    UNIVERSITY_PROGRAMS.forEach((program) => groups[categorize(program, ranking)].push(program));
    return groups;
  }, [ranking]);

  async function persist(next: UniversityProgram[]) {
    if (!selectedStudentId) return;
    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: selectedStudentId, programIds: next.map((p) => p.id) }),
      });
    } catch {
      showError("Tercih listesi kaydedilemedi.");
    }
  }

  function addToList(program: UniversityProgram) {
    setPreferenceList((prev) => {
      const next = prev.some((row) => row.id === program.id) ? prev : [...prev, program];
      persist(next);
      return next;
    });
  }

  function removeFromList(id: string) {
    setPreferenceList((prev) => {
      const next = prev.filter((row) => row.id !== id);
      persist(next);
      return next;
    });
  }

  function moveItem(index: number, direction: -1 | 1) {
    setPreferenceList((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      persist(next);
      return next;
    });
  }

  if (!student) {
    return <p className="text-xs text-espresso-muted dark:text-cream/40">Öğrenci bulunamadı.</p>;
  }

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70"
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <Wand2 className="h-4 w-4 text-brand-600" /> YKS & LGS Tercih Robotu
          </h2>
          <span className="flex items-center gap-1 rounded-full bg-cream-card px-2.5 py-1 text-[10px] text-espresso-muted dark:bg-white/5 dark:text-cream/40">
            <Info className="h-3 w-3" /> Sıralama değerleri temsilidir, gerçek ÖSYM verisi değildir
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={selectedStudentId}
            onChange={(event) => setSelectedStudentId(event.target.value)}
            className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          >
            {studentOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.firstName} {row.lastName} — {row.branchName}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 rounded-lg border border-hairline bg-white px-3 py-2 dark:border-white/10 dark:bg-midnight">
            <span className="text-xs text-espresso-muted dark:text-cream/40">Tahmini Sıralama</span>
            <input
              type="number"
              value={ranking}
              onChange={(event) => setRanking(Number(event.target.value) || 0)}
              className="ml-auto w-24 bg-transparent text-right text-sm font-semibold text-espresso outline-none dark:text-cream"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-espresso-muted dark:text-cream/40">
          {student.firstName} {student.lastName} için {ranking.toLocaleString("tr-TR")}. sıralama baz alınarak bölümler kategorilere ayrıldı.
        </p>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        {(["hayal", "ideal", "garanti"] as PreferenceCategory[]).map((category) => (
          <motion.div
            key={category}
            whileHover={{ scale: 1.01, y: -3 }}
            className={cn("rounded-3xl border p-4 shadow-sm backdrop-blur-sm", CATEGORY_STYLES[category])}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-espresso dark:text-cream">{PREFERENCE_CATEGORY_LABEL[category]}</h3>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", CATEGORY_BADGE[category])}>
                {grouped[category].length} bölüm
              </span>
            </div>
            <div className="space-y-2">
              {grouped[category].map((program, index) => (
                <motion.div
                  key={program.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="flex items-center justify-between gap-2 rounded-xl bg-white/80 p-2.5 text-xs dark:bg-midnight-card/80"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-espresso dark:text-cream">{program.university}</p>
                    <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">
                      {program.department} · {program.city}
                    </p>
                    <p className="text-[10px] text-espresso-muted dark:text-cream/40">Taban: {program.minRanking.toLocaleString("tr-TR")}</p>
                  </div>
                  <button
                    onClick={() => addToList(program)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-espresso text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              ))}
              {grouped[category].length === 0 && (
                <p className="text-[11px] text-espresso-muted dark:text-cream/40">Bu kategoride bölüm bulunamadı.</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70"
      >
        <h2 className="mb-4 text-sm font-semibold text-espresso dark:text-cream">Tercih Listem — {student.firstName} {student.lastName}</h2>
        <div className="space-y-2">
          <AnimatePresence>
            {preferenceList.map((program, index) => (
              <motion.div
                key={program.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex items-center gap-3 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-espresso text-[11px] font-semibold text-cream dark:bg-brand-600">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-espresso dark:text-cream">{program.university}</p>
                  <p className="truncate text-[11px] text-espresso-muted dark:text-cream/40">{program.department}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium", CATEGORY_BADGE[categorize(program, ranking)])}>
                  {PREFERENCE_CATEGORY_LABEL[categorize(program, ranking)]}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-espresso-muted transition hover:bg-white disabled:opacity-30 dark:text-cream/40 dark:hover:bg-white/10"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveItem(index, 1)}
                    disabled={index === preferenceList.length - 1}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-espresso-muted transition hover:bg-white disabled:opacity-30 dark:text-cream/40 dark:hover:bg-white/10"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => removeFromList(program.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-espresso-muted transition hover:bg-rose-100 hover:text-rose-600 dark:text-cream/40 dark:hover:bg-rose-500/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {preferenceList.length === 0 && (
            <p className="text-xs text-espresso-muted dark:text-cream/40">
              Yukarıdaki kategorilerden &quot;+&quot; ile bölüm ekleyerek tercih listesi oluşturmaya başlayın.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
