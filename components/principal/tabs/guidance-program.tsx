"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Send, FileText, CheckCircle2, History, PenLine, AlertTriangle, Loader2, Search, ExternalLink } from "lucide-react";
import { DAYS_OF_WEEK, STUDENT_TOPIC_ANALYSIS, type DayOfWeek, type WeeklyProgramEntry } from "@/lib/mock-data";
import { A4ProgramPreview } from "@/components/principal/guidance/a4-program-preview";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type StudentOption = { id: string; firstName: string; lastName: string; branchName: string };
type ProgramEntry = { id: string; day: string; time: string; subject: string; topic: string; questionTarget: number };
type Program = { id: string; weekLabel: string; createdAt: string; entries: ProgramEntry[] };

function DayColumn({
  day,
  entries,
  onAdd,
  onRemove,
}: {
  day: DayOfWeek;
  entries: WeeklyProgramEntry[];
  onAdd: (entry: Omit<WeeklyProgramEntry, "id" | "day">) => void;
  onRemove: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [time, setTime] = useState("16:00 - 17:00");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [target, setTarget] = useState(20);

  function handleAdd() {
    if (!subject.trim() || !topic.trim()) return;
    onAdd({ time, subject, topic, questionTarget: target });
    setSubject("");
    setTopic("");
    setIsAdding(false);
  }

  return (
    <div className="w-52 shrink-0 rounded-2xl border border-hairline bg-cream-card p-3 dark:border-white/10 dark:bg-white/5">
      <p className="mb-2 text-xs font-semibold text-espresso dark:text-cream">{day}</p>
      <div className="space-y-1.5">
        {entries.map((entry) => (
          <motion.div
            key={entry.id}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="group rounded-lg bg-white p-2 text-[11px] dark:bg-midnight-card"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-espresso dark:text-cream">{entry.subject}</span>
              <button
                onClick={() => onRemove(entry.id)}
                className="text-espresso-muted opacity-0 transition group-hover:opacity-100 hover:text-rose-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="text-espresso-muted dark:text-cream/40">{entry.topic}</p>
            <p className="mt-0.5 text-brand-600">
              {entry.time} · {entry.questionTarget} soru
            </p>
          </motion.div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {isAdding ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 space-y-1.5 overflow-hidden rounded-lg border border-hairline bg-white p-2 dark:border-white/10 dark:bg-midnight"
          >
            <input
              value={time}
              onChange={(event) => setTime(event.target.value)}
              placeholder="Saat"
              className="w-full rounded border border-hairline px-2 py-1 text-[11px] text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Ders"
              className="w-full rounded border border-hairline px-2 py-1 text-[11px] text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Konu"
              className="w-full rounded border border-hairline px-2 py-1 text-[11px] text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
            <input
              type="number"
              value={target}
              onChange={(event) => setTarget(Number(event.target.value))}
              placeholder="Hedef soru"
              className="w-full rounded border border-hairline px-2 py-1 text-[11px] text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
            <div className="flex gap-1">
              <button onClick={handleAdd} className="flex-1 rounded bg-espresso py-1 text-[11px] text-cream dark:bg-brand-600">
                Ekle
              </button>
              <button onClick={() => setIsAdding(false)} className="rounded px-2 text-[11px] text-espresso-muted dark:text-cream/40">
                İptal
              </button>
            </div>
          </motion.div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-hairline py-1.5 text-[11px] text-espresso-muted transition hover:border-brand-600 hover:text-brand-600 dark:border-white/10 dark:text-cream/40"
          >
            <Plus className="h-3 w-3" /> Hedef Ekle
          </button>
        )}
      </AnimatePresence>
    </div>
  );
}

// Öğrenci seçici — kurum onlarca/yüzlerce öğrenciye ulaştığında düz bir
// <select> içinde ismi arayarak bulmak pratik değil; roster zaten tek
// seferde tam olarak client'a çekiliyor (bkz. GuidanceProgramTab'daki
// fetch), bu yüzden arama sunucuya gitmeden burada, yerel olarak yapılır.
function StudentSearchSelect({
  students,
  selectedStudentId,
  onSelect,
}: {
  students: StudentOption[];
  selectedStudentId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = students.find((row) => row.id === selectedStudentId);
  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const filtered = normalizedQuery
    ? students.filter((row) => `${row.firstName} ${row.lastName} ${row.branchName}`.toLocaleLowerCase("tr-TR").includes(normalizedQuery))
    : students;

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
        <input
          value={open ? query : selected ? `${selected.firstName} ${selected.lastName} — ${selected.branchName}` : ""}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          placeholder="Öğrenci ara (ad veya şube)..."
          className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-hairline bg-white p-1 shadow-xl dark:border-white/10 dark:bg-midnight-card"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-espresso-muted dark:text-cream/40">Sonuç bulunamadı.</p>
            ) : (
              filtered.map((row) => (
                <button
                  key={row.id}
                  onClick={() => {
                    onSelect(row.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition hover:bg-cream-card dark:hover:bg-white/5",
                    row.id === selectedStudentId && "bg-brand-50 dark:bg-brand-600/10"
                  )}
                >
                  <span className="font-medium text-espresso dark:text-cream">
                    {row.firstName} {row.lastName}
                  </span>
                  <span className="text-espresso-muted dark:text-cream/40">{row.branchName}</span>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function GuidanceProgramTab() {
  const { showError, showToast } = useToast();
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [view, setView] = useState<"builder" | "history">("builder");
  const [draftEntries, setDraftEntries] = useState<WeeklyProgramEntry[]>([]);
  const [studentHistory, setStudentHistory] = useState<Program[]>([]);
  const [sending, setSending] = useState(false);
  const [sentFeedback, setSentFeedback] = useState(false);
  const [isA4Open, setIsA4Open] = useState(false);
  const [previewProgram, setPreviewProgram] = useState<Program | null>(null);

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
    fetch(`/api/guidance-program?studentId=${encodeURIComponent(selectedStudentId)}`)
      .then((res) => res.json())
      .then((data) => setStudentHistory(data.programs ?? []))
      .catch(() => showError("Program geçmişi yüklenemedi."));
  }, [selectedStudentId, showError]);

  const student = studentOptions.find((row) => row.id === selectedStudentId);
  const analysis = STUDENT_TOPIC_ANALYSIS[selectedStudentId] ?? [];

  function addEntry(day: DayOfWeek, entry: Omit<WeeklyProgramEntry, "id" | "day">) {
    setDraftEntries((prev) => [...prev, { ...entry, id: crypto.randomUUID(), day }]);
  }

  function removeEntry(id: string) {
    setDraftEntries((prev) => prev.filter((entry) => entry.id !== id));
  }

  async function handleSendToPortal() {
    if (draftEntries.length === 0 || !selectedStudentId) return;
    setSending(true);
    try {
      const res = await fetch("/api/guidance-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId,
          weekLabel: "Bu Hafta",
          entries: draftEntries.map(({ day, time, subject, topic, questionTarget }) => ({ day, time, subject, topic, questionTarget })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Program gönderilemedi.");
      setStudentHistory((prev) => [data.program, ...prev]);
      setDraftEntries([]);
      setSentFeedback(true);
      setTimeout(() => setSentFeedback(false), 2500);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Program gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  // "Routinix'e Aktar" — Routinix Kampüs'ün DIŞINDA, ayrı bir sistem
  // (kullanıcının kendi tanımı). Gerçek entegrasyon (API/kimlik bilgisi)
  // henüz sağlanmadı; sahte/stub bir bağlantı kurmak yerine buton
  // BİLEREK burada durduruluyor, gerçek bilgi geldiğinde bu handler
  // gerçek bir isteğe bağlanacak.
  function handleTransferToRoutinix() {
    showToast("info", "Routinix entegrasyonu henüz bağlanmadı — gerekli API bilgileri sağlandığında bu buton aktif olacak.");
  }

  if (!student) {
    return <p className="text-xs text-espresso-muted dark:text-cream/40">Öğrenci bulunamadı.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StudentSearchSelect students={studentOptions} selectedStudentId={selectedStudentId} onSelect={setSelectedStudentId} />

        <div className="flex gap-1.5 rounded-full border border-hairline bg-white/70 p-1 dark:border-white/10 dark:bg-midnight-card/50">
          <button
            onClick={() => setView("builder")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              view === "builder" ? "bg-brand-600 text-white" : "text-espresso-muted dark:text-cream/40"
            )}
          >
            <PenLine className="h-3.5 w-3.5" /> Yeni Program
          </button>
          <button
            onClick={() => setView("history")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              view === "history" ? "bg-brand-600 text-white" : "text-espresso-muted dark:text-cream/40"
            )}
          >
            <History className="h-3.5 w-3.5" /> Geçmiş & Analiz
          </button>
        </div>
      </div>

      {view === "builder" ? (
        <motion.div
          key="builder"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-espresso dark:text-cream">
              {student.firstName} {student.lastName} — Haftalık Çalışma Programı
            </h2>
            <span className="text-xs text-espresso-muted dark:text-cream/40">{draftEntries.length} hedef eklendi</span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {DAYS_OF_WEEK.map((day) => (
              <DayColumn
                key={day}
                day={day}
                entries={draftEntries.filter((entry) => entry.day === day)}
                onAdd={(entry) => addEntry(day, entry)}
                onRemove={removeEntry}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-hairline pt-4 dark:border-white/10">
            <button
              onClick={handleSendToPortal}
              disabled={draftEntries.length === 0 || sending}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : sentFeedback ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              {sentFeedback ? "Öğrenci Portalına Gönderildi" : "Öğrenci Portalına Gönder"}
            </button>
            <button
              onClick={() => setIsA4Open(true)}
              disabled={draftEntries.length === 0}
              className="flex items-center gap-2 rounded-lg border border-hairline px-4 py-2 text-xs font-medium text-espresso transition hover:bg-cream-card disabled:opacity-50 dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
            >
              <FileText className="h-3.5 w-3.5" /> Kurumsal A4 PDF Çıktısı Al
            </button>
            <button
              onClick={handleTransferToRoutinix}
              className="flex items-center gap-2 rounded-lg border border-dashed border-hairline px-4 py-2 text-xs font-medium text-espresso-muted transition hover:border-brand-600/50 hover:text-espresso dark:border-white/10 dark:text-cream/40 dark:hover:text-cream"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Routinix&apos;e Aktar
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
            <h2 className="mb-4 text-sm font-semibold text-espresso dark:text-cream">Geçmiş Programlar — {student.firstName} {student.lastName}</h2>
            <div className="space-y-2">
              {studentHistory.length === 0 && (
                <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz kayıtlı program yok.</p>
              )}
              {studentHistory.map((program, index) => (
                <motion.button
                  key={program.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setPreviewProgram(program)}
                  className="flex w-full items-center justify-between rounded-xl bg-cream-card px-3 py-2.5 text-left transition hover:bg-brand-50 dark:bg-white/5 dark:hover:bg-brand-600/10"
                >
                  <div>
                    <p className="text-sm font-medium text-espresso dark:text-cream">{program.weekLabel}</p>
                    <p className="text-[11px] text-espresso-muted dark:text-cream/40">
                      {program.entries.length} hedef · {new Date(program.createdAt).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                  <FileText className="h-4 w-4 text-brand-600" />
                </motion.button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
            <h2 className="mb-4 text-sm font-semibold text-espresso dark:text-cream">Konu Analiz Kartı</h2>
            <div className="space-y-4">
              {analysis.length === 0 && (
                <p className="text-xs text-espresso-muted dark:text-cream/40">Bu öğrenci için analiz verisi yok.</p>
              )}
              {analysis.map((entry) => (
                <div key={entry.examName}>
                  <p className="mb-1.5 text-xs font-medium text-espresso dark:text-cream/80">{entry.examName}</p>
                  {entry.hasTopicData ? (
                    <div className="space-y-2">
                      {entry.topics?.map((topic) => (
                        <div key={topic.name}>
                          <div className="mb-0.5 flex items-center justify-between text-[11px]">
                            <span className="text-espresso-muted dark:text-cream/50">{topic.name}</span>
                            <span className="text-espresso-muted dark:text-cream/50">%{topic.successRate}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                            <motion.div
                              className="h-full rounded-full bg-brand-600"
                              initial={{ width: 0 }}
                              animate={{ width: `${topic.successRate}%` }}
                              transition={{ type: "spring", stiffness: 70, damping: 15 }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-xl border border-brand-600/30 bg-brand-50 p-3 text-[11px] text-brand-800 dark:bg-brand-600/10 dark:text-brand-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Bu deneme sınavı için soru konu dağılım verisi (Excel/Soru Havuzu) yüklenmemiştir. Konu bazlı
                        analiz yapabilmek için Optik Yükleme ekranından konu anahtarını tamamlayınız.
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <A4ProgramPreview
        isOpen={isA4Open}
        onClose={() => setIsA4Open(false)}
        studentName={`${student.firstName} ${student.lastName}`}
        weekLabel="Bu Hafta"
        entries={draftEntries}
      />
      <A4ProgramPreview
        isOpen={!!previewProgram}
        onClose={() => setPreviewProgram(null)}
        studentName={`${student.firstName} ${student.lastName}`}
        weekLabel={previewProgram?.weekLabel ?? ""}
        entries={previewProgram?.entries.map((e) => ({ ...e, day: e.day as DayOfWeek })) ?? []}
      />
    </div>
  );
}
