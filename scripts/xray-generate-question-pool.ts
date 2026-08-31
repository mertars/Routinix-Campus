// Faz Z3/Z4/Z5 — Akademik Röntgen soru havuzu otomasyon worker'ı. Vercel'de
// DEĞİL, uzun süre çalışan bir arka plan süreci olarak çalıştırılır:
//   npx tsx --env-file=.env.local scripts/xray-generate-question-pool.ts
// İsteğe bağlı test bayrakları: --topics=N ("genel" için ilk N konuyla
// sınırla), --subtopics=N ("alt_konu" için ilk N alt konuyla sınırla),
// --rounds=N (hedef tur sayısını geçici olarak değiştir).
//
// "yeterlilik" (20 soru/zor) prompt'u henüz tasarlanmadı — Control.
// activeVariants'ta aktif olsa bile worker prompt bulamayınca sadece
// loglar, atlar — asla hatayla durmaz.
//
// Durum TAMAMEN DB'de tutulur (XrayPoolGenerationRound/Control) — bu yüzden
// süreç kesintiye uğrarsa (Ctrl+C, ağ hatası, makine uykuya dalması) yeniden
// çalıştırıldığında zaten "success" olan turları ATLAR, kaldığı yerden
// devam eder. /platform panelindeki Duraklat düğmesi Control.paused'u
// true yapar — worker HER turdan önce bu bayrağı taze okur.
import { prisma } from "../lib/server/prisma";
import { flattenTopics, flattenCurriculum, type FlattenedTopic, type FlattenedSubtopic } from "../lib/server/xray/question-generation/curriculum-flatten";
import { callChatCompletion } from "../lib/server/xray/question-generation/ai-client";
import {
  SYSTEM_PROMPT_GENEL,
  buildGenelRound1UserPrompt,
  buildGenelRoundNUserPrompt,
  SYSTEM_PROMPT_ALT_KONU,
  buildAltKonuRound1UserPrompt,
  buildAltKonuRoundNUserPrompt,
  buildRetryCorrectionSuffix,
  SYSTEM_PROMPT_FIX,
  buildFixUserPrompt,
  type FlawedQuestionContext,
} from "../lib/server/xray/question-generation/prompt";
import { validateGenelRoundResponse, validateAltKonuRoundResponse, validateFixResponse, type GenelBlueprintSlot } from "../lib/server/xray/question-generation/validate-round";
import { verifyContent, type VerificationIssue } from "../lib/server/xray/question-generation/verify-content";
import { slugifyTestName } from "../lib/server/xray/question-pool-upload";

const SUBJECT = "Matematik";
const MODEL = "deepseek-v4-flash-0731";
const MAX_TOKENS = 16000;
const VERIFY_MAX_TOKENS = 4000;
const MAX_ATTEMPTS_PER_ROUND = 3;
const MAX_FIX_ATTEMPTS = 2;
const DEFAULT_TARGET_ROUNDS = 10;

// "yeterlilik" prompt'u tasarlanınca buraya eklenecek.
const IMPLEMENTED_VARIANTS = new Set(["genel", "alt_konu"]);

type FixableQuestion = { soruNo: number; kazanimId: string; questionText: string; finalAnswer: string; detailedSolution: string; diagnosticComment: string };

// Faz Z9 — kullanıcı talebi: "hatalı sorudan dolayı baştan yapması sadece
// hatalı olan soruyu düzeltsin". İçerik denetimi (verify-content.ts) bir
// turun 30/10 sorusundan sadece 1-2'sini "sorunlu" bulsa bile önceden
// TÜM tur (bkz. generateGenelRound/generateAltKonuRound'daki eski hali)
// sıfırdan yeniden üretiliyordu — hem israf hem de zaten doğru olan
// soruların bir daha üretilip denetlenmesi anlamsızdı. Bu fonksiyon SADECE
// flawed soruların İÇERİĞİNİ (questionText/finalAnswer/detailedSolution/
// diagnosticComment) yeniden yazdırır, soruNo/kazanımId/subtopicId
// (blueprint yapısı) ASLA değişmez. Düzeltilen sorular tekrar (SADECE
// kendileri) içerik denetiminden geçer — düzeltme kendisi de hatalıysa
// MAX_FIX_ATTEMPTS'e kadar tekrar dener.
async function fixFlaggedQuestions<Q extends FixableQuestion>(
  questions: Q[],
  issues: VerificationIssue[],
  subtopicNameBySoruNo: Map<number, string> | null,
): Promise<{ ok: true; questions: Q[]; tokensUsed: number } | { ok: false; tokensUsed: number }> {
  let current = questions;
  let remainingIssues = issues;
  let tokensUsed = 0;
  for (let fixAttempt = 1; fixAttempt <= MAX_FIX_ATTEMPTS; fixAttempt++) {
    const flawed: FlawedQuestionContext[] = remainingIssues.map((issue) => {
      const q = current.find((x) => x.soruNo === issue.soruNo)!;
      return { soruNo: q.soruNo, kazanimId: q.kazanimId, subtopicName: subtopicNameBySoruNo?.get(q.soruNo), oldQuestionText: q.questionText, reason: issue.reason };
    });
    console.log(`    🔧 Hedefli düzeltme ${fixAttempt}/${MAX_FIX_ATTEMPTS} — ${flawed.length} soru: ${flawed.map((f) => f.soruNo).join(",")}`);

    const fixCompletion = await callChatCompletion({ model: MODEL, systemPrompt: SYSTEM_PROMPT_FIX, userPrompt: buildFixUserPrompt(flawed), maxTokens: MAX_TOKENS });
    tokensUsed += fixCompletion.totalTokens;
    const fixValidation = validateFixResponse(
      fixCompletion.content,
      flawed.map((f) => f.soruNo),
    );
    if (!fixValidation.ok) {
      console.log(`    ⚠️ Düzeltme yanıtı geçersiz: ${fixValidation.errorSummary}`);
      continue;
    }

    const fixedBySoruNo = new Map(fixValidation.fixed.map((f) => [f.soruNo, f]));
    current = current.map((q) => {
      const f = fixedBySoruNo.get(q.soruNo);
      return f ? { ...q, questionText: f.questionText, finalAnswer: f.finalAnswer, detailedSolution: f.detailedSolution, diagnosticComment: f.diagnosticComment } : q;
    });

    const toRecheck = current.filter((q) => fixedBySoruNo.has(q.soruNo));
    const recheck = await verifyContent(MODEL, VERIFY_MAX_TOKENS, toRecheck);
    tokensUsed += recheck.tokensUsed;
    if (recheck.ok === true) return { ok: true, questions: current, tokensUsed };
    remainingIssues = recheck.ok === false ? recheck.issues : remainingIssues;
    console.log(`    ⚠️ Düzeltme sonrası hâlâ sorunlu: ${remainingIssues.map((i) => `soruNo ${i.soruNo}: ${i.reason}`).join(" | ")}`);
  }
  return { ok: false, tokensUsed };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const found = args.find((a) => a.startsWith(`--${flag}=`));
    return found ? Number(found.split("=")[1]) : undefined;
  };
  return { topicsLimit: get("topics"), subtopicsLimit: get("subtopics"), roundsOverride: get("rounds") };
}

async function getControl() {
  let control = await prisma.xrayPoolGenerationControl.findUnique({ where: { id: "singleton" } });
  if (!control) control = await prisma.xrayPoolGenerationControl.create({ data: { id: "singleton" } });
  const dayMs = 24 * 60 * 60 * 1000;
  if (Date.now() - control.budgetResetAt.getTime() > dayMs) {
    control = await prisma.xrayPoolGenerationControl.update({ where: { id: "singleton" }, data: { tokensUsedToday: 0, budgetResetAt: new Date() } });
  }
  return control;
}

async function recordTokenUsage(tokens: number) {
  await prisma.xrayPoolGenerationControl.update({
    where: { id: "singleton" },
    data: { tokensUsedToday: { increment: tokens }, tokensUsedTotal: { increment: tokens } },
  });
}

async function getLockedBlueprint<T>(variant: string, unitId: string): Promise<T | null> {
  const round1 = await prisma.xrayPoolGenerationRound.findUnique({ where: { subject_variant_unitId_roundNumber: { subject: SUBJECT, variant, unitId, roundNumber: 1 } } });
  if (round1?.status === "success" && round1.blueprint) return round1.blueprint as unknown as T;
  return null;
}

async function checkGate(): Promise<{ status: "ok"; activeVariants: string[] } | { status: "stop" }> {
  const control = await getControl();
  if (control.paused) {
    console.log("⏸️  Control.paused=true — worker durduruluyor.");
    return { status: "stop" };
  }
  if (control.tokensUsedToday >= control.dailyTokenBudget) {
    console.log(`⏸️  Günlük token bütçesi doldu (${control.tokensUsedToday}/${control.dailyTokenBudget}) — worker durduruluyor.`);
    return { status: "stop" };
  }
  return { status: "ok", activeVariants: control.activeVariants as unknown as string[] };
}

async function writeRoundResult(params: {
  variant: string;
  unitId: string;
  roundNumber: number;
  testId: string;
  testName: string;
  result:
    | { ok: true; questions: { soruNo: number; subtopicId: string; kazanimId: string; questionText: string; finalAnswer: string; detailedSolution: string; diagnosticComment: string }[]; blueprint: unknown; tokensUsed: number; attempts: number }
    | { ok: false; errorSummary: string; tokensUsed: number; attempts: number };
}) {
  const { variant, unitId, roundNumber, testId, testName, result } = params;
  if (result.ok) {
    await prisma.$transaction([
      prisma.xrayPracticeQuestion.deleteMany({ where: { testId } }),
      prisma.xrayPracticeQuestion.createMany({
        data: result.questions.map((q) => ({
          subject: SUBJECT,
          subtopicId: q.subtopicId,
          variant,
          testId,
          testName,
          order: q.soruNo,
          kazanimId: q.kazanimId,
          prompt: q.questionText,
          correctAnswer: q.finalAnswer,
          solution: q.detailedSolution,
          checks: q.diagnosticComment,
        })),
      }),
      prisma.xrayPoolGenerationRound.upsert({
        where: { subject_variant_unitId_roundNumber: { subject: SUBJECT, variant, unitId, roundNumber } },
        create: { subject: SUBJECT, variant, unitId, roundNumber, status: "success", blueprint: result.blueprint as never, testId, attempts: result.attempts, tokensUsed: result.tokensUsed },
        update: { status: "success", blueprint: result.blueprint as never, testId, attempts: result.attempts, tokensUsed: result.tokensUsed, errorMessage: null },
      }),
    ]);
    console.log(`  ✅ Tur ${roundNumber} yazıldı (${result.questions.length} soru, ${result.tokensUsed} token, ${result.attempts} deneme).`);
  } else {
    await prisma.xrayPoolGenerationRound.upsert({
      where: { subject_variant_unitId_roundNumber: { subject: SUBJECT, variant, unitId, roundNumber } },
      create: { subject: SUBJECT, variant, unitId, roundNumber, status: "failed", attempts: result.attempts, tokensUsed: result.tokensUsed, errorMessage: result.errorSummary },
      update: { status: "failed", attempts: result.attempts, tokensUsed: result.tokensUsed, errorMessage: result.errorSummary },
    });
    console.log(`  ❌ Tur ${roundNumber} başarısız (${result.attempts} deneme sonrası): ${result.errorSummary}`);
  }
}

// ── "genel" — 30 soru, tema tümü ──

async function generateGenelRound(topic: FlattenedTopic, roundNumber: number, lockedBlueprint: GenelBlueprintSlot[] | null) {
  let totalTokens = 0;
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_ROUND; attempt++) {
    const basePrompt = roundNumber === 1 ? buildGenelRound1UserPrompt(topic) : buildGenelRoundNUserPrompt(topic, lockedBlueprint!, roundNumber);
    const userPrompt = attempt === 1 ? basePrompt : basePrompt + buildRetryCorrectionSuffix(lastError);
    const completion = await callChatCompletion({ model: MODEL, systemPrompt: SYSTEM_PROMPT_GENEL, userPrompt, maxTokens: MAX_TOKENS });
    totalTokens += completion.totalTokens;
    const validation = validateGenelRoundResponse(completion.content, topic, lockedBlueprint);
    if (!validation.ok) {
      lastError = validation.errorSummary;
      console.log(`    ⚠️ Deneme ${attempt}/${MAX_ATTEMPTS_PER_ROUND} başarısız (yapısal): ${lastError}`);
      continue;
    }

    const check = await verifyContent(MODEL, VERIFY_MAX_TOKENS, validation.questions);
    totalTokens += check.tokensUsed;
    if (check.ok === true) return { ok: true as const, questions: validation.questions, blueprint: validation.blueprint, tokensUsed: totalTokens, attempts: attempt };

    if (check.ok === false) {
      const subtopicNameBySoruNo = new Map(validation.questions.map((q) => [q.soruNo, topic.subtopics.find((s) => s.subtopicId === q.subtopicId)?.subtopicName ?? q.subtopicId]));
      const fixResult = await fixFlaggedQuestions(validation.questions, check.issues, subtopicNameBySoruNo);
      totalTokens += fixResult.tokensUsed;
      if (fixResult.ok) return { ok: true as const, questions: fixResult.questions, blueprint: validation.blueprint, tokensUsed: totalTokens, attempts: attempt };
      lastError = `Hedefli düzeltme başarısız oldu (${check.issues.length} soru), tur yeniden üretiliyor.`;
    } else {
      lastError = `İçerik kontrolü başarısız oldu: ${check.errorSummary}`;
    }
    console.log(`    ⚠️ Deneme ${attempt}/${MAX_ATTEMPTS_PER_ROUND} başarısız (içerik kontrolü): ${lastError}`);
  }
  return { ok: false as const, errorSummary: lastError, tokensUsed: totalTokens, attempts: MAX_ATTEMPTS_PER_ROUND };
}

async function runVariantGenel(topics: FlattenedTopic[], targetRounds: number): Promise<"continue" | "stop"> {
  for (const topic of topics) {
    for (let roundNumber = 1; roundNumber <= targetRounds; roundNumber++) {
      const gate = await checkGate();
      if (gate.status === "stop") return "stop";
      if (!gate.activeVariants.includes("genel")) return "continue";

      const existing = await prisma.xrayPoolGenerationRound.findUnique({ where: { subject_variant_unitId_roundNumber: { subject: SUBJECT, variant: "genel", unitId: topic.topicId, roundNumber } } });
      if (existing?.status === "success") {
        console.log(`↷ [genel] ${topic.topicName} tur ${roundNumber} zaten tamam, atlanıyor.`);
        continue;
      }

      let lockedBlueprint: GenelBlueprintSlot[] | null = null;
      if (roundNumber > 1) {
        lockedBlueprint = await getLockedBlueprint<GenelBlueprintSlot[]>("genel", topic.topicId);
        if (!lockedBlueprint) {
          console.log(`⏭️  [genel] ${topic.topicName}: 1. tur başarılı değil, ${roundNumber}. tur atlanıyor.`);
          break;
        }
      }

      console.log(`▶ [genel] ${topic.grade}.sınıf > ${topic.topicName} — Tur ${roundNumber}/${targetRounds}`);
      const result = await generateGenelRound(topic, roundNumber, lockedBlueprint);
      await recordTokenUsage(result.tokensUsed);
      await writeRoundResult({
        variant: "genel",
        unitId: topic.topicId,
        roundNumber,
        testId: slugifyTestName(`genel-${topic.topicId}-tur-${roundNumber}`),
        testName: `${topic.topicName} — Genel Havuz Turu ${roundNumber}`,
        result,
      });
    }
  }
  return "continue";
}

// ── "alt_konu" — 10 soru, tek alt konu, orta seviye ──

async function generateAltKonuRound(subtopic: FlattenedSubtopic, roundNumber: number, lockedBlueprint: string[] | null) {
  let totalTokens = 0;
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_ROUND; attempt++) {
    const basePrompt = roundNumber === 1 ? buildAltKonuRound1UserPrompt(subtopic) : buildAltKonuRoundNUserPrompt(subtopic, lockedBlueprint!, roundNumber);
    const userPrompt = attempt === 1 ? basePrompt : basePrompt + buildRetryCorrectionSuffix(lastError);
    const completion = await callChatCompletion({ model: MODEL, systemPrompt: SYSTEM_PROMPT_ALT_KONU, userPrompt, maxTokens: MAX_TOKENS });
    totalTokens += completion.totalTokens;
    const validation = validateAltKonuRoundResponse(completion.content, lockedBlueprint);
    if (!validation.ok) {
      lastError = validation.errorSummary;
      console.log(`    ⚠️ Deneme ${attempt}/${MAX_ATTEMPTS_PER_ROUND} başarısız (yapısal): ${lastError}`);
      continue;
    }

    const check = await verifyContent(MODEL, VERIFY_MAX_TOKENS, validation.questions);
    totalTokens += check.tokensUsed;
    if (check.ok === true) {
      const questions = validation.questions.map((q) => ({ ...q, subtopicId: subtopic.subtopicId }));
      return { ok: true as const, questions, blueprint: validation.blueprint, tokensUsed: totalTokens, attempts: attempt };
    }

    if (check.ok === false) {
      const fixResult = await fixFlaggedQuestions(validation.questions, check.issues, null);
      totalTokens += fixResult.tokensUsed;
      if (fixResult.ok) {
        const questions = fixResult.questions.map((q) => ({ ...q, subtopicId: subtopic.subtopicId }));
        return { ok: true as const, questions, blueprint: validation.blueprint, tokensUsed: totalTokens, attempts: attempt };
      }
      lastError = `Hedefli düzeltme başarısız oldu (${check.issues.length} soru), tur yeniden üretiliyor.`;
    } else {
      lastError = `İçerik kontrolü başarısız oldu: ${check.errorSummary}`;
    }
    console.log(`    ⚠️ Deneme ${attempt}/${MAX_ATTEMPTS_PER_ROUND} başarısız (içerik kontrolü): ${lastError}`);
  }
  return { ok: false as const, errorSummary: lastError, tokensUsed: totalTokens, attempts: MAX_ATTEMPTS_PER_ROUND };
}

async function runVariantAltKonu(subtopics: FlattenedSubtopic[], targetRounds: number): Promise<"continue" | "stop"> {
  for (const subtopic of subtopics) {
    for (let roundNumber = 1; roundNumber <= targetRounds; roundNumber++) {
      const gate = await checkGate();
      if (gate.status === "stop") return "stop";
      if (!gate.activeVariants.includes("alt_konu")) return "continue";

      const existing = await prisma.xrayPoolGenerationRound.findUnique({ where: { subject_variant_unitId_roundNumber: { subject: SUBJECT, variant: "alt_konu", unitId: subtopic.subtopicId, roundNumber } } });
      if (existing?.status === "success") {
        console.log(`↷ [alt_konu] ${subtopic.subtopicName} tur ${roundNumber} zaten tamam, atlanıyor.`);
        continue;
      }

      let lockedBlueprint: string[] | null = null;
      if (roundNumber > 1) {
        lockedBlueprint = await getLockedBlueprint<string[]>("alt_konu", subtopic.subtopicId);
        if (!lockedBlueprint) {
          console.log(`⏭️  [alt_konu] ${subtopic.subtopicName}: 1. tur başarılı değil, ${roundNumber}. tur atlanıyor.`);
          break;
        }
      }

      console.log(`▶ [alt_konu] ${subtopic.grade}.sınıf > ${subtopic.topicName} > ${subtopic.subtopicName} — Tur ${roundNumber}/${targetRounds}`);
      const result = await generateAltKonuRound(subtopic, roundNumber, lockedBlueprint);
      await recordTokenUsage(result.tokensUsed);
      await writeRoundResult({
        variant: "alt_konu",
        unitId: subtopic.subtopicId,
        roundNumber,
        testId: slugifyTestName(`altkonu-${subtopic.subtopicId}-tur-${roundNumber}`),
        testName: `${subtopic.subtopicName} — Alt Konu Havuz Turu ${roundNumber}`,
        result,
      });
    }
  }
  return "continue";
}

async function main() {
  const { topicsLimit, subtopicsLimit, roundsOverride } = parseArgs();
  const targetRounds = roundsOverride ?? DEFAULT_TARGET_ROUNDS;
  let topics = flattenTopics(SUBJECT);
  if (topicsLimit) topics = topics.slice(0, topicsLimit);
  let subtopics = flattenCurriculum(SUBJECT);
  if (subtopicsLimit) subtopics = subtopics.slice(0, subtopicsLimit);

  const control = await getControl();
  const activeVariants = (control.activeVariants as unknown as string[]).filter((v) => IMPLEMENTED_VARIANTS.has(v));
  const skipped = (control.activeVariants as unknown as string[]).filter((v) => !IMPLEMENTED_VARIANTS.has(v));
  if (skipped.length > 0) console.log(`ℹ️  Şu variant'ların prompt'u henüz yok, atlanıyor: ${skipped.join(", ")}`);

  console.log(`Worker başladı — model: ${MODEL}, hedef ${targetRounds} tur/birim, aktif variant'lar: ${activeVariants.join(", ") || "(yok)"}`);

  if (activeVariants.includes("genel")) {
    const outcome = await runVariantGenel(topics, targetRounds);
    if (outcome === "stop") return;
  }
  if (activeVariants.includes("alt_konu")) {
    const outcome = await runVariantAltKonu(subtopics, targetRounds);
    if (outcome === "stop") return;
  }

  console.log("Worker tamamlandı (aktif variant'lar için tüm konular/turlar işlendi).");
}

main()
  .catch((err) => {
    console.error("Worker hata ile durdu:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
