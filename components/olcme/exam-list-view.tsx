"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, Search, CalendarDays, Users, KeyRound, ScanLine, Folder, ArrowLeft, FolderOpen, X, Layers, Check } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { NewExamWizard } from "./new-exam-wizard";
import { YksGroupView } from "./yks-group-view";
import { type ExamListItem, type ExamCategory, formatExamDate } from "./types";

const UNCATEGORIZED = "__uncategorized__";

function statusOf(exam: ExamListItem) {
  if (exam.studentCount > 0) return { label: "Sonuçlandı", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
  if (exam.answerKeySubjectCount > 0) return { label: "Sonuç bekliyor", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" };
  return { label: "Hazırlanıyor", className: "border-hairline bg-cream-card text-espresso-muted dark:border-white/10 dark:bg-white/5 dark:text-cream/40" };
}

// Deneme listesi iki katmanlı: önce KLASÖRLER, içine girince o klasörün
// denemeleri. Klasörler kuruma ait yönetilebilir kayıtlardır (bkz.
// ExamCategory): platform varsayılan seti kurar (5-12. Sınıf, TYT, AYT,
// LGS, YKS), kurum yenisini ekleyip istemediğini kaldırabilir.
//
// YKS klasörü özeldir (kind = YKS_PAIR): tekil deneme değil, TYT+AYT
// EŞLEŞMELERİ listeler — bkz. YksGroupView.
export function ExamListView({ onSelect }: { onSelect: (examId: string) => void }) {
  const { showError, showSuccess } = useToast();
  const [exams, setExams] = useState<ExamListItem[] | null>(null);
  const [categories, setCategories] = useState<ExamCategory[] | null>(null);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const load = useCallback(async () => {
    const [examRes, catRes] = await Promise.all([
      fetch("/api/exams").then((r) => r.json()).catch(() => null),
      fetch("/api/exam-categories").then((r) => r.json()).catch(() => null),
    ]);
    if (!examRes || !catRes) return showError("Denemeler yüklenemedi.");
    setExams(examRes.exams ?? []);
    setCategories(catRes.categories ?? []);
    setUncategorizedCount(catRes.uncategorizedCount ?? 0);
  }, [showError]);

  useEffect(() => {
    load();
  }, [load]);

  const openCategory = useMemo(() => (openId && openId !== UNCATEGORIZED ? categories?.find((c) => c.id === openId) ?? null : null), [openId, categories]);

  const openFolderExams = useMemo(() => {
    if (!openId || !exams) return [];
    const items = openId === UNCATEGORIZED ? exams.filter((e) => !e.categoryId) : exams.filter((e) => e.categoryId === openId);
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return q ? items.filter((e) => e.name.toLocaleLowerCase("tr-TR").includes(q)) : items;
  }, [exams, openId, query]);

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const res = await fetch("/api/exam-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return showError(data?.error ?? "Klasör eklenemedi.");
    setNewCategoryName("");
    setAddingCategory(false);
    load();
  }

  async function removeCategory(category: ExamCategory) {
    const warning =
      category.examCount > 0
        ? `"${category.name}" klasörünü kaldırmak istediğine emin misin? İçindeki ${category.examCount} deneme SİLİNMEZ, "Kategorisiz" klasörüne taşınır.`
        : `"${category.name}" klasörünü kaldırmak istediğine emin misin?`;
    if (!window.confirm(warning)) return;
    const res = await fetch(`/api/exam-categories/${category.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) return showError(data?.error ?? "Klasör kaldırılamadı.");
    if (data?.movedToUncategorized > 0) showSuccess(`Klasör kaldırıldı — ${data.movedToUncategorized} deneme Kategorisiz'e taşındı.`);
    load();
  }

  const wizard = (
    <NewExamWizard
      isOpen={wizardOpen}
      onClose={() => setWizardOpen(false)}
      defaultCategoryId={openCategory && openCategory.kind === "STANDARD" ? openCategory.id : undefined}
      onCreated={async (newExamId) => {
        setWizardOpen(false);
        await load();
        onSelect(newExamId);
      }}
    />
  );

  // ---------- YKS klasörü (eşleştirme görünümü) ----------
  if (openCategory?.kind === "YKS_PAIR") {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-10">
        <button
          onClick={() => setOpenId(null)}
          className="mb-4 flex items-center gap-1.5 text-[11px] font-medium text-espresso-muted transition hover:text-espresso dark:text-cream/40 dark:hover:text-cream"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Tüm klasörler
        </button>
        <YksGroupView categoryName={openCategory.name} onSelectExam={onSelect} onChanged={load} />
      </div>
    );
  }

  // ---------- Klasör içi ----------
  if (openId) {
    const title = openCategory?.name ?? "Kategorisiz";
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-10">
        <button
          onClick={() => {
            setOpenId(null);
            setQuery("");
          }}
          className="mb-4 flex items-center gap-1.5 text-[11px] font-medium text-espresso-muted transition hover:text-espresso dark:text-cream/40 dark:hover:text-cream"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Tüm klasörler
        </button>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-espresso dark:text-cream">
              <FolderOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> {title}
            </h1>
            <p className="mt-1 text-xs text-espresso-muted dark:text-cream/40">{openFolderExams.length} deneme</p>
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

        {openFolderExams.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-hairline bg-white/40 py-20 text-center dark:border-white/10 dark:bg-white/5">
            <p className="text-xs text-espresso-muted dark:text-cream/40">Bu klasörde deneme yok.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {openFolderExams.map((exam, i) => {
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
        )}
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

      {categories === null || exams === null ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((category, i) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
              className="group relative"
            >
              <button
                onClick={() => setOpenId(category.id)}
                className="flex w-full flex-col gap-3 rounded-2xl border border-hairline bg-white/70 p-4 text-left shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-emerald-400/40 hover:shadow-md dark:border-white/10 dark:bg-midnight-card/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl transition",
                      category.kind === "YKS_PAIR" ? "bg-sky-500/10 group-hover:bg-sky-500/15" : "bg-emerald-500/10 group-hover:bg-emerald-500/15"
                    )}
                  >
                    {category.kind === "YKS_PAIR" ? (
                      <Layers className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    ) : (
                      <Folder className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </span>
                  {category.kind === "YKS_PAIR" && (
                    <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[9px] font-semibold text-sky-700 dark:text-sky-300">
                      TYT + AYT
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-espresso dark:text-cream">{category.name}</p>
                  <p className="mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">
                    {category.examCount} {category.kind === "YKS_PAIR" ? "eşleşme" : "deneme"}
                  </p>
                </div>
              </button>
              <button
                onClick={() => removeCategory(category)}
                title="Klasörü kaldır"
                className="absolute right-2.5 top-2.5 rounded-lg p-1 text-espresso-muted/40 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-500 group-hover:opacity-100 dark:text-cream/30"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}

          {uncategorizedCount > 0 && (
            <button
              onClick={() => setOpenId(UNCATEGORIZED)}
              className="flex flex-col gap-3 rounded-2xl border border-dashed border-hairline bg-white/40 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400/40 hover:shadow-md dark:border-white/15 dark:bg-white/5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-muted dark:bg-white/10">
                <Folder className="h-4 w-4 text-espresso-muted dark:text-cream/40" />
              </span>
              <div>
                <p className="text-sm font-semibold text-espresso dark:text-cream">Kategorisiz</p>
                <p className="mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">{uncategorizedCount} deneme</p>
              </div>
            </button>
          )}

          {/* Yeni klasör */}
          {addingCategory ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.04] p-4">
              <input
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCategory();
                  if (e.key === "Escape") {
                    setAddingCategory(false);
                    setNewCategoryName("");
                  }
                }}
                placeholder="Klasör adı"
                className="w-full rounded-lg border border-hairline bg-white px-2.5 py-2 text-xs text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    setAddingCategory(false);
                    setNewCategoryName("");
                  }}
                  className="flex-1 rounded-lg border border-hairline py-1.5 text-[11px] font-medium text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/50"
                >
                  Vazgeç
                </button>
                <button
                  onClick={addCategory}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-500"
                >
                  <Check className="h-3 w-3" /> Ekle
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingCategory(true)}
              className="flex min-h-[7.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-hairline bg-transparent p-4 text-espresso-muted transition hover:border-emerald-400/50 hover:bg-emerald-500/5 hover:text-emerald-700 dark:border-white/15 dark:text-cream/40 dark:hover:text-emerald-300"
            >
              <Plus className="h-4 w-4" />
              <span className="text-[11.5px] font-semibold">Klasör Ekle</span>
            </button>
          )}
        </div>
      )}
      {wizard}
    </div>
  );
}
