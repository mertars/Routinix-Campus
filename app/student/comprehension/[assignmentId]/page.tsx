"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ShieldAlert, Loader2, Check, ChevronRight, Flag, ArrowLeft } from "lucide-react";
import { useToast } from "@/lib/toast-context";

type Option = { id: string; label: string; text: string };
type Question = { id: string; difficulty: number; prompt: string; options: Option[] };
type Phase = "loading" | "intro" | "exam" | "flagged" | "completed" | "error";

// Akademik Röntgen — Test 2 "Ne Kadar Anlamış" KİLİTLİ sınav ekranı.
// BİLEREK üst bar/menü/geri butonu YOK (bkz. Faz C tasarım kararı:
// "gerçekçi maksimum" kilit seviyesi). Tarayıcıda OS seviyeli bir
// engelleme MÜMKÜN DEĞİL — bunun yerine sekme değiştirme/pencere odağı
// kaybı/tam ekrandan çıkma ALGILANIR ve sınav ANINDA sonlandırılır
// (bkz. handleViolation). Bu caydırıcı bir önlemdir, teknik bir kilit
// DEĞİLDİR — teknik bir kullanıcı yine de aşabilir, kullanıcıya bu
// açıkça söylenmişti (bkz. proje kararı).
export default function ComprehensionExamPage() {
  const params = useParams<{ assignmentId: string }>();
  const router = useRouter();
  const { showError } = useToast();
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ total: number; correct: number } | null>(null);
  const [flagReason, setFlagReason] = useState<string | null>(null);
  const phaseRef = useRef<Phase>("loading");
  phaseRef.current = phase;

  useEffect(() => {
    // Atama zaten bitmiş mi (COMPLETED/FLAGGED) diye önce sessizce kontrol
    // etmiyoruz — GET route'u zaten 409 döner, "intro" ekranında "Sınava
    // Başla"ya basılınca bu hata orada gösterilir.
    setPhase("intro");
  }, []);

  async function reportViolation(reason: string) {
    if (phaseRef.current !== "exam") return;
    setFlagReason(reason);
    setPhase("flagged");
    try {
      await fetch(`/api/xray/comprehension-assignment/${params.assignmentId}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
    } catch {
      // sessiz — zaten sınav bitti, kullanıcıya "flagged" ekranı gösteriliyor
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  useEffect(() => {
    if (phase !== "exam") return;

    const onVisibilityChange = () => {
      if (document.hidden) reportViolation("Sekme değiştirildi veya pencere küçültüldü.");
    };
    const onBlur = () => reportViolation("Pencere odağı kaybedildi (başka bir uygulamaya geçildi).");
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) reportViolation("Tam ekrandan çıkıldı.");
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function startExam() {
    setPhase("loading");
    try {
      document.documentElement.requestFullscreen?.().catch(() => {
        // Tam ekran reddedilirse/desteklenmezse yine de devam — sekme
        // değiştirme/odak kaybı algılaması fullscreen'den BAĞIMSIZ çalışır.
      });
      const res = await fetch(`/api/xray/comprehension-assignment/${params.assignmentId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sınav başlatılamadı.");
      setQuestions(data.questions);
      setCurrentIndex(0);
      setSelectedOptionId(null);
      setPhase("exam");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Sınav başlatılamadı.");
      setPhase("error");
    }
  }

  async function selectOption(optionId: string) {
    setSelectedOptionId(optionId);
    setSaving(true);
    try {
      await fetch(`/api/xray/comprehension-assignment/${params.assignmentId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: questions[currentIndex].id, selectedOptionId: optionId }),
      });
    } catch {
      showError("Cevap kaydedilemedi, tekrar dene.");
    } finally {
      setSaving(false);
    }
  }

  function nextQuestion() {
    setSelectedOptionId(null);
    setCurrentIndex((i) => i + 1);
  }

  async function finishExam() {
    setPhase("loading");
    try {
      const res = await fetch(`/api/xray/comprehension-assignment/${params.assignmentId}/complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sınav bitirilemedi.");
      setSummary(data);
      setPhase("completed");
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch (error) {
      showError(error instanceof Error ? error.message : "Sınav bitirilemedi.");
      setPhase("exam");
    }
  }

  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-midnight px-4 py-8 text-cream">
      <div className="mx-auto w-full max-w-lg flex-1">
        <AnimatePresence mode="wait">
          {phase === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full items-center justify-center gap-2 py-20 text-sm text-cream/50">
              <Loader2 className="h-5 w-5 animate-spin" /> Hazırlanıyor...
            </motion.div>
          )}

          {phase === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pt-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                <Lock className="h-8 w-8" />
              </div>
              <h1 className="text-lg font-bold">Kilitli Sınav Modu</h1>
              <p className="text-sm text-cream/60">
                Sınav başladığında tam ekrana geçilecek. Sekme değiştirirsen, başka bir pencereye geçersen ya da tam ekrandan çıkarsan sınav
                anında sonlandırılır ve yarım kalır. Kesintisiz çalışabileceğin bir yerde ol.
              </p>
              <button
                onClick={startExam}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-sm font-semibold text-midnight transition hover:bg-amber-400"
              >
                Anladım, Sınava Başla
              </button>
            </motion.div>
          )}

          {phase === "exam" && question && (
            <motion.div key={question.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="space-y-5 pt-6">
              <div className="flex items-center justify-between text-xs text-cream/40">
                <span className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Kilitli Sınav
                </span>
                <span>
                  Soru {currentIndex + 1}/{questions.length}
                </span>
              </div>
              <p className="text-base font-medium leading-relaxed">{question.prompt}</p>
              <div className="space-y-2.5">
                {question.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => selectOption(option.id)}
                    className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl border px-4 text-left text-sm font-medium transition ${
                      selectedOptionId === option.id
                        ? "border-amber-400 bg-amber-500/10 text-amber-300"
                        : "border-white/10 bg-white/5 text-cream hover:border-white/20"
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                      {option.label}
                    </span>
                    {option.text}
                  </button>
                ))}
              </div>
              <button
                onClick={isLast ? finishExam : nextQuestion}
                disabled={!selectedOptionId || saving}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-sm font-semibold text-midnight transition hover:bg-amber-400 disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isLast ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {isLast ? "Sınavı Bitir" : "Sonraki Soru"}
              </button>
            </motion.div>
          )}

          {phase === "flagged" && (
            <motion.div key="flagged" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
                <Flag className="h-8 w-8" />
              </div>
              <h1 className="text-lg font-bold">Sınav Sonlandırıldı</h1>
              <p className="text-sm text-cream/60">{flagReason}</p>
              <p className="text-xs text-cream/40">Bu sınav kilit ihlali nedeniyle yarım kaldı. Durum öğretmenine/yöneticine bildirildi.</p>
              <button
                onClick={() => router.push("/student")}
                className="mx-auto flex min-h-[44px] items-center gap-2 rounded-2xl border border-white/10 px-5 text-sm font-medium text-cream/70 transition hover:bg-white/5"
              >
                <ArrowLeft className="h-4 w-4" /> Panele Dön
              </button>
            </motion.div>
          )}

          {phase === "completed" && summary && (
            <motion.div key="completed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                <Check className="h-8 w-8" />
              </div>
              <h1 className="text-lg font-bold">Sınav Tamamlandı</h1>
              <p className="text-sm text-cream/60">
                {summary.correct}/{summary.total} doğru — detaylı sonuç değerlendirilip öğretmenine/yöneticine iletilecek.
              </p>
              <button
                onClick={() => router.push("/student")}
                className="mx-auto flex min-h-[44px] items-center gap-2 rounded-2xl bg-white/10 px-5 text-sm font-medium text-cream transition hover:bg-white/15"
              >
                <ArrowLeft className="h-4 w-4" /> Panele Dön
              </button>
            </motion.div>
          )}

          {phase === "error" && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <p className="text-sm text-cream/60">Bu sınava erişilemedi — daha önce tamamlanmış veya iptal edilmiş olabilir.</p>
              <button
                onClick={() => router.push("/student")}
                className="mx-auto flex min-h-[44px] items-center gap-2 rounded-2xl border border-white/10 px-5 text-sm font-medium text-cream/70 transition hover:bg-white/5"
              >
                <ArrowLeft className="h-4 w-4" /> Panele Dön
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
