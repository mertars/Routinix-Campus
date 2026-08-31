"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, ChevronDown, Loader2, CheckCircle2, Database } from "lucide-react";
import { CURRICULUM_TREE, XRAY_SUBJECTS, XRAY_MIN_GRADE } from "@/lib/mock-data";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type PoolTopic = { subtopicId: string; subtopicName: string; questionCount: number; kazanimCount: number };

const PLACEHOLDER = `{
  "konu": "12. Sınıf - Belirsiz İntegral",
  "test_adi": "Test 3: Kuvvet Kuralı Uygulamaları",
  "sorular": [
    {
      "soruNo": 1,
      "kazanimId": "INTEGRAL_KUVVET_KURALI",
      "questionText": "∫x^4 dx integralinin sonucunu bulunuz.",
      "finalAnswer": "x^5/5 + C",
      "detailedSolution": "Kuvvet kuralına göre üs 1 artırılır, yeni üse bölünür.",
      "diagnosticComment": "Öğrenci bu soruda zorlandıysa: kuvvet kuralı eksiktir."
    }
  ]
}`;

// Faz W — kullanıcının kendi hazırladığı JSON formatındaki soru
// havuzlarını (bkz. prisma/seed-xray-practice-test.ts'teki AYNI format)
// doğrudan admin panelinden Test 1 (Konu Bilgisi) havuzuna yüklemesi.
// "konu" alanı SADECE etiket — gerçek ders/konu eşlemesi burada AŞAĞIDA
// seçilen subject+subtopic'ten gelir (bkz. upload route'undaki AYNI
// gerekçe). Her yükleme testId'ye (test_adi'nin slug'ı) göre idempotent —
// aynı test_adi ile tekrar yüklenirse eskisinin YERİNE geçer, farklı
// test_adi'lerle onlarca kez yüklenerek havuz büyütülür (kullanıcının
// "her konudan 10ar test yükleyeceğim" isteğiyle birebir eşleşiyor).
export function XrayQuestionPoolUpload() {
  const { showError, showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [subject, setSubject] = useState(XRAY_SUBJECTS[0]);
  const [subtopicId, setSubtopicId] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [poolTopics, setPoolTopics] = useState<PoolTopic[] | null>(null);

  const subtopicOptions = (CURRICULUM_TREE[subject] ?? []).filter((t) => t.grade >= XRAY_MIN_GRADE).flatMap((t) => t.subtopics);

  useEffect(() => {
    setSubtopicId((current) => current || subtopicOptions[0]?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  function refreshPoolStats() {
    fetch(`/api/xray/practice-tests?subject=${encodeURIComponent(subject)}`)
      .then((res) => res.json())
      .then((data) => setPoolTopics(data.topics ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    if (!expanded) return;
    refreshPoolStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, subject]);

  async function upload() {
    if (!subtopicId) {
      showError("Önce bir konu seç.");
      return;
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch {
      showError("Geçerli bir JSON değil — söz dizimini kontrol et.");
      return;
    }
    setUploading(true);
    try {
      const res = await fetch("/api/xray/practice-questions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, subtopicId, test: parsedJson }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Yükleme başarısız.");
      showToast("success", `${data.count} soru havuza eklendi.`);
      setJsonText("");
      refreshPoolStats();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Yükleme başarısız.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-[1600px] overflow-hidden rounded-3xl border border-sky-500/20 bg-white/70 shadow-sm backdrop-blur-sm dark:border-sky-400/15 dark:bg-midnight-card/50"
    >
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-espresso dark:text-cream">
          <UploadCloud className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          Soru Havuzu Yükle
        </span>
        <ChevronDown className={cn("h-4 w-4 text-espresso-muted transition-transform dark:text-cream/40", expanded && "rotate-180")} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid grid-cols-1 gap-4 px-5 pb-5 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <select
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
                  >
                    {XRAY_SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <select
                    value={subtopicId}
                    onChange={(event) => setSubtopicId(event.target.value)}
                    disabled={subtopicOptions.length === 0}
                    className="min-w-[160px] flex-1 rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
                  >
                    {subtopicOptions.length === 0 && <option value="">Bu ders için lise konusu yok</option>}
                    {subtopicOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] leading-relaxed text-espresso-muted dark:text-cream/50">
                  Yukarıda seçtiğin konu, sorunun PUANLAMADA kullanılacağı gerçek konudur — JSON içindeki &quot;konu&quot; alanı sadece etiket, eşleşmesi
                  gerekmez. &quot;test_adi&quot; her yüklemede benzersiz olmalı (aynı isimle tekrar yüklersen o yüklemenin yerini alır, farklı isimle
                  yüklersen havuza EKLENİR).
                </p>
                <textarea
                  value={jsonText}
                  onChange={(event) => setJsonText(event.target.value)}
                  placeholder={PLACEHOLDER}
                  rows={12}
                  spellCheck={false}
                  className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 font-mono text-[11px] leading-relaxed text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
                />
                <button
                  onClick={upload}
                  disabled={uploading || !jsonText.trim()}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  Havuza Yükle
                </button>
              </div>

              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                  <Database className="h-3.5 w-3.5" /> {subject} Havuzunun Güncel Durumu
                </h4>
                {poolTopics === null && <p className="text-xs text-espresso-muted dark:text-cream/40">Yükleniyor...</p>}
                {poolTopics !== null && poolTopics.length === 0 && (
                  <p className="text-xs text-espresso-muted dark:text-cream/40">Bu ders için havuzda henüz hiç soru yok.</p>
                )}
                <div className="space-y-1.5">
                  {poolTopics?.map((t) => (
                    <div
                      key={t.subtopicId}
                      className={cn(
                        "flex items-center justify-between rounded-xl px-3 py-2 text-xs",
                        t.subtopicId === subtopicId ? "bg-sky-500/10 text-sky-800 dark:text-sky-300" : "bg-cream-card text-espresso dark:bg-white/5 dark:text-cream"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        {t.subtopicId === subtopicId && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{t.subtopicName}</span>
                      </span>
                      <span className="shrink-0 font-semibold">
                        {t.questionCount} soru · {t.kazanimCount} kazanım
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
