"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, Loader2, Download, ArrowRight } from "lucide-react";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";
import { fetchAndDownloadPdf } from "@/lib/client/download-pdf";

const SUBJECT = "Matematik"; // Faz F: soru havuzu şu an sadece bu dersi kapsıyor

type PracticeTopic = { subtopicId: string; subtopicName: string; questionCount: number; kazanimCount: number };

// Akademik Röntgen — Test 1 "Konu Bilgisi" giriş noktası. Faz G: liste
// artık sabit "testler" değil KONULAR — her konu, onlarca yüklemenin
// birikmiş bir HAVUZUDUR (bkz. lib/server/xray/practice-pool.ts); bir
// konuya her girişte (veya PDF indirişte) sistem o havuzdan rastgele YENİ
// bir 30 soruluk test derler.
export function XrayPracticeTest() {
  const router = useRouter();
  const { studentId } = useStudentScope();
  const { showError } = useToast();
  const [topics, setTopics] = useState<PracticeTopic[] | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/xray/practice-tests?subject=${encodeURIComponent(SUBJECT)}`)
      .then((res) => res.json())
      .then((data) => setTopics(data.topics ?? []))
      .catch(() => showError("Konu listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function downloadWorksheet(topic: PracticeTopic) {
    if (!studentId) return;
    setDownloadingId(topic.subtopicId);
    try {
      // Her indirme havuzdan TAZE bir rastgele çekim yapar (bkz. attempt
      // oluşturma mantığı) — ekranda çözülenle AYNI garanti değil, ama
      // aynı kazanım kapsamına sahip başka bir somut örnek.
      const res = await fetch("/api/xray/practice-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, subject: SUBJECT, subtopicId: topic.subtopicId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Test oluşturulamadı.");
      await fetchAndDownloadPdf(
        `/api/xray/practice-worksheet?attemptId=${encodeURIComponent(data.attemptId)}`,
        undefined,
        `${topic.subtopicName}-calisma-yapragi.pdf`.replace(/\s+/g, "-")
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "PDF oluşturulamadı.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <motion.div
      whileHover={{ scale: 1.005, y: -2 }}
      className="rounded-3xl border border-sky-500/20 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-sky-400/15 dark:bg-midnight-card/50"
    >
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <BookOpen className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Konu Bilgisi Testi — Soru Bankası
      </h2>

      {topics === null && (
        <div className="flex items-center gap-2 py-4 text-xs text-espresso-muted dark:text-cream/40">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
        </div>
      )}
      {topics?.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz bu ders için soru bankası hazır değil.</p>}

      <div className="space-y-2">
        {topics?.map((topic) => (
          <div key={topic.subtopicId} className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/student/practice/${topic.subtopicId}?subject=${encodeURIComponent(SUBJECT)}`)}
              className="flex min-h-[52px] min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl bg-cream-card px-4 text-left transition hover:bg-sky-500/10 dark:bg-white/5"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-espresso dark:text-cream">{topic.subtopicName}</span>
                <span className="block truncate text-xs text-espresso-muted dark:text-cream/40">
                  {topic.kazanimCount} kazanım · {topic.questionCount} soru havuzu
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
            </button>
            <button
              onClick={() => downloadWorksheet(topic)}
              disabled={downloadingId === topic.subtopicId}
              aria-label="Çalışma yaprağını indir"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-sky-500/25 bg-sky-500/10 text-sky-600 transition hover:bg-sky-500/20 disabled:opacity-60 dark:text-sky-300"
            >
              {downloadingId === topic.subtopicId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
