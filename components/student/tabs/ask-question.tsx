"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, Camera, Images, X, Send, Clock, RotateCcw, Loader2, CheckCircle2 } from "lucide-react";
import { useStudentScope } from "@/lib/student-scope";
import { AvatarInitials } from "@/components/principal/avatar-initials";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type TeacherOption = { id: string; firstName: string; lastName: string; subject: string };

type QuestionStatus = "PENDING" | "ANSWERED" | "SOLVED";

type QuestionEntry = {
  id: string;
  subject: string;
  studentNote: string | null;
  status: QuestionStatus;
  answerText: string | null;
  createdAt: string;
  teacher: { firstName: string; lastName: string; subject: string };
};

const STATUS_LABEL: Record<QuestionStatus, string> = { PENDING: "Bekliyor", ANSWERED: "Yanıtlandı", SOLVED: "Çözüldü" };
const STATUS_BADGE: Record<QuestionStatus, string> = {
  PENDING: "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300",
  ANSWERED: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  SOLVED: "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/40",
};

export function AskQuestionTab() {
  const { studentId } = useStudentScope();

  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [teachersError, setTeachersError] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { showSuccess, showError } = useToast();

  const [questions, setQuestions] = useState<QuestionEntry[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);

  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  async function loadTeachers() {
    try {
      const res = await fetch("/api/teachers");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTeachers(data.teachers ?? []);
      setTeachersError(false);
    } catch {
      setTeachersError(true);
    }
  }

  async function loadQuestions() {
    setQuestionsLoading(true);
    try {
      const res = await fetch(`/api/questions?studentId=${encodeURIComponent(studentId)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQuestions(data.questions ?? []);
    } catch {
      // Sessizce boş bırak — aşağıdaki liste zaten "yok" durumunu gösterir.
    } finally {
      setQuestionsLoading(false);
    }
  }

  useEffect(() => {
    loadTeachers();
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  function pickFile(file: File | undefined) {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearFile() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (cameraInput.current) cameraInput.current.value = "";
    if (galleryInput.current) galleryInput.current.value = "";
  }

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);
  const canSend = !!selectedTeacher && !!imageFile && !submitting;

  async function send() {
    if (!selectedTeacher || !imageFile) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("studentId", studentId);
      form.set("teacherId", selectedTeacher.id);
      form.set("subject", selectedTeacher.subject);
      form.set("studentNote", note.trim());
      form.set("image", imageFile);

      const res = await fetch("/api/questions", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Soru gönderilemedi.");

      showSuccess(`Sorun ${selectedTeacher.firstName} ${selectedTeacher.lastName}'a iletildi!`);
      clearFile();
      setNote("");
      loadQuestions();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Soru gönderilemedi, lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <HelpCircle className="h-4 w-4 text-brand-600" /> Yeni Soru Sor
        </h2>

        <p className="mb-1.5 text-[11px] font-medium text-espresso-muted dark:text-cream/40">Öğretmen Seç</p>
        {teachersError ? (
          <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2.5 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            Öğretmen listesi şu anda yüklenemedi.
          </p>
        ) : (
          <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {teachers.map((teacher) => {
              const isActive = teacher.id === selectedTeacherId;
              return (
                <button
                  key={teacher.id}
                  onClick={() => setSelectedTeacherId(teacher.id)}
                  className={cn(
                    "flex min-h-[64px] w-32 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5 text-center transition",
                    isActive ? "border-brand-600 bg-brand-600 text-white" : "border-hairline bg-cream-card text-espresso dark:border-white/10 dark:bg-white/5 dark:text-cream"
                  )}
                >
                  <AvatarInitials
                    name={`${teacher.firstName} ${teacher.lastName}`}
                    className={cn("h-8 w-8 text-xs", isActive && "bg-white/20 text-white")}
                  />
                  <span className="w-full truncate text-[11px] font-semibold leading-tight">{teacher.firstName} {teacher.lastName}</span>
                  <span className={cn("text-[9px] leading-tight", isActive ? "text-white/70" : "text-espresso-muted dark:text-cream/40")}>{teacher.subject}</span>
                </button>
              );
            })}
            {teachers.length === 0 && !teachersError && <p className="py-4 text-xs text-espresso-muted dark:text-cream/40">Öğretmenler yükleniyor...</p>}
          </div>
        )}

        <p className="mb-1.5 text-[11px] font-medium text-espresso-muted dark:text-cream/40">Soru Fotoğrafı</p>
        {imagePreview ? (
          <div className="relative mb-3 overflow-hidden rounded-2xl bg-cream-card dark:bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Soru önizlemesi" className="max-h-56 w-full object-contain" />
            <button
              onClick={clearFile}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
              aria-label="Fotoğrafı kaldır"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => cameraInput.current?.click()}
              className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-hairline text-xs font-medium text-espresso-muted transition hover:border-brand-600/40 hover:text-brand-600 dark:border-white/10 dark:text-cream/40"
            >
              <Camera className="h-5 w-5" /> Kamerayla Çek
            </button>
            <button
              onClick={() => galleryInput.current?.click()}
              className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-hairline text-xs font-medium text-espresso-muted transition hover:border-brand-600/40 hover:text-brand-600 dark:border-white/10 dark:text-cream/40"
            >
              <Images className="h-5 w-5" /> Galeriden Seç
            </button>
          </div>
        )}
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
        <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Sorunla ilgili bir not ekle (isteğe bağlı) — örn. '3. adımı anlamadım'"
          rows={3}
          className="mb-3 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />

        <button
          onClick={send}
          disabled={!canSend}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? "Gönderiliyor..." : "Öğretmene Gönder"}
        </button>
      </motion.div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <Clock className="h-4 w-4 text-brand-600" /> Sorularım
          </h2>
          <button onClick={loadQuestions} className="flex h-7 w-7 items-center justify-center rounded-full text-espresso-muted hover:bg-cream-card dark:text-cream/40 dark:hover:bg-white/5">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-2">
          {questions.map((q) => (
            <div key={q.id} className="rounded-xl bg-cream-card p-3 dark:bg-white/5">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-espresso dark:text-cream">{q.subject} · {q.teacher.firstName} {q.teacher.lastName}</p>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium", STATUS_BADGE[q.status])}>{STATUS_LABEL[q.status]}</span>
              </div>
              {q.studentNote && <p className="text-xs text-espresso-muted dark:text-cream/50">{q.studentNote}</p>}
              {q.answerText && (
                <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:bg-green-500/10 dark:text-green-400">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {q.answerText}
                </p>
              )}
              <p className="mt-1 text-[10px] text-espresso-muted/70 dark:text-cream/30">{new Date(q.createdAt).toLocaleString("tr-TR")}</p>
            </div>
          ))}
          {!questionsLoading && questions.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz soru sormadın.</p>}
          {questionsLoading && <p className="text-xs text-espresso-muted dark:text-cream/40">Yükleniyor...</p>}
        </div>
      </motion.div>
    </div>
  );
}
