"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { HelpCircle, CheckCircle2, Send, RotateCcw, Loader2, ImagePlus, X } from "lucide-react";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type QuestionStatus = "PENDING" | "ANSWERED" | "SOLVED";

type QuestionEntry = {
  id: string;
  subject: string;
  imageUrl: string;
  studentNote: string | null;
  status: QuestionStatus;
  answerText: string | null;
  answerImageUrl: string | null;
  createdAt: string;
  student: { firstName: string; lastName: string };
};

const STATUS_BADGE: Record<QuestionStatus, string> = {
  PENDING: "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300",
  ANSWERED: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  SOLVED: "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/40",
};

const STATUS_LABEL: Record<QuestionStatus, string> = { PENDING: "Bekliyor", ANSWERED: "Yanıtlandı", SOLVED: "Çözüldü" };

// Kullanıcı talebi: "cevabı öğretmen ... fotoğraf veya direkt yazarak
// anlatabilir" — eskiden SADECE metin girişi vardı. İkisi birden de
// gönderilebilir; en az biri zorunlu.
function AnswerBox({ onSubmit }: { onSubmit: (text: string, file: File | null) => Promise<void> }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!text.trim() && !file) return;
    setSending(true);
    await onSubmit(text.trim(), file);
    setSending(false);
  }

  return (
    <div className="mt-2 space-y-1.5">
      {file && (
        <div className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs dark:bg-midnight">
          <span className="flex-1 truncate text-espresso dark:text-cream">{file.name}</span>
          <button onClick={() => setFile(null)} className="text-espresso-muted hover:text-rose-600 dark:text-cream/40">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Yanıtınızı yazın (opsiyonel — fotoğraf da ekleyebilirsiniz)"
          className="min-h-[40px] flex-1 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Fotoğraf ekle"
          className="flex min-h-[40px] items-center justify-center rounded-lg border border-hairline px-2.5 text-espresso-muted transition hover:text-brand-600 dark:border-white/10 dark:text-cream/40"
        >
          <ImagePlus className="h-3.5 w-3.5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const f = event.target.files?.[0];
            if (f) setFile(f);
            event.target.value = "";
          }}
        />
        <button
          onClick={submit}
          disabled={sending || (!text.trim() && !file)}
          className="flex min-h-[40px] items-center gap-1 rounded-lg bg-espresso px-3 text-xs font-medium text-cream disabled:opacity-50 dark:bg-brand-600"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function QuestionPoolTab() {
  const { staffRecord } = useTeacherScope();
  const { showError } = useToast();
  const [questions, setQuestions] = useState<QuestionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  async function loadQuestions(showErrorOnFail = true) {
    if (showErrorOnFail) setLoading(true);
    try {
      const res = await fetch(`/api/questions?teacherId=${encodeURIComponent(staffRecord.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sorular yüklenemedi.");
      setQuestions(data.questions ?? []);
      setLoadError(false);
    } catch (error) {
      if (showErrorOnFail) {
        setLoadError(true);
        showError(error instanceof Error ? error.message : "Sorular yüklenemedi, veritabanı bağlantısını kontrol edin.");
      }
    } finally {
      if (showErrorOnFail) setLoading(false);
    }
  }

  useEffect(() => {
    if (!staffRecord.id) return;
    loadQuestions(true);
    // Öğrencinin gönderdiği yeni soru elle yenileme beklemeden görünsün.
    const interval = setInterval(() => loadQuestions(false), 7000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffRecord.id]);

  async function answer(id: string, answerText: string, file: File | null) {
    try {
      let res: Response;
      if (file) {
        const form = new FormData();
        if (answerText) form.append("answerText", answerText);
        form.append("image", file);
        res = await fetch(`/api/questions/${id}`, { method: "PATCH", body: form });
      } else {
        res = await fetch(`/api/questions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answerText }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Yanıt gönderilemedi.");
      setOpenId(null);
      loadQuestions();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Yanıt gönderilemedi, lütfen tekrar deneyin.");
    }
  }

  const pending = questions.filter((q) => q.status === "PENDING");
  const answered = questions.filter((q) => q.status !== "PENDING");

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <HelpCircle className="h-4 w-4 text-brand-600" /> Soru Çözüm Havuzu — Öğrencilerden Gelenler
          </h2>
          <button onClick={() => loadQuestions(true)} className="flex h-7 w-7 items-center justify-center rounded-full text-espresso-muted hover:bg-cream-card dark:text-cream/40 dark:hover:bg-white/5">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {loadError && (
          <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2.5 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            Sorular şu anda yüklenemedi (veritabanı bağlantısı olmayabilir).
          </p>
        )}

        <div className="space-y-2.5">
          {[...pending, ...answered].map((question, index) => (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-xl bg-cream-card p-3 dark:bg-white/5"
            >
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-espresso dark:text-cream">
                    {question.student.firstName} {question.student.lastName} <span className="text-espresso-muted dark:text-cream/40">· {question.subject}</span>
                  </p>
                  {question.studentNote && <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/50">{question.studentNote}</p>}
                  <p className="mt-0.5 text-[10px] text-espresso-muted/70 dark:text-cream/30">{new Date(question.createdAt).toLocaleString("tr-TR")}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium", STATUS_BADGE[question.status])}>
                  {STATUS_LABEL[question.status]}
                </span>
              </div>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={question.imageUrl} alt="Soru fotoğrafı" className="mb-2 max-h-48 w-full rounded-lg object-contain bg-white dark:bg-midnight" />

              {question.status === "PENDING" && (
                <>
                  {openId === question.id ? (
                    <AnswerBox onSubmit={(text, file) => answer(question.id, text, file)} />
                  ) : (
                    <button
                      onClick={() => setOpenId(question.id)}
                      className="mt-1 min-h-[36px] rounded-full bg-espresso px-3 py-1 text-[11px] font-medium text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
                    >
                      Yanıtla
                    </button>
                  )}
                </>
              )}
              {question.status !== "PENDING" && question.answerText && (
                <p className="mt-1 flex items-start gap-1.5 text-[11px] text-green-700 dark:text-green-400">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" /> {question.answerText}
                </p>
              )}
              {question.status !== "PENDING" && question.answerImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={question.answerImageUrl} alt="Yanıt fotoğrafı" className="mt-1.5 max-h-40 rounded-lg border border-hairline object-contain dark:border-white/10" />
              )}
            </motion.div>
          ))}
          {!loading && !loadError && questions.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Bekleyen soru yok.</p>}
          {loading && <p className="text-xs text-espresso-muted dark:text-cream/40">Yükleniyor...</p>}
        </div>
      </motion.div>
    </div>
  );
}
