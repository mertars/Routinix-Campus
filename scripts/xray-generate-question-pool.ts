// Faz Z3 — Akademik Röntgen soru havuzu otomasyon worker'ı. Vercel'de DEĞİL,
// uzun süre çalışan bir arka plan süreci olarak çalıştırılır:
//   npx tsx --env-file=.env.local scripts/xray-generate-question-pool.ts
// İsteğe bağlı test bayrakları: --subtopics=N (ilk N alt konuyla sınırla),
// --rounds=N (alt konu başına hedef tur sayısını geçici olarak değiştir).
//
// Durum TAMAMEN DB'de tutulur (XrayPoolGenerationRound/Control) — bu yüzden
// süreç kesintiye uğrarsa (Ctrl+C, ağ hatası, makine uykuya dalması) yeniden
// çalıştırıldığında zaten "success" olan turları ATLAR, kaldığı yerden
// devam eder. /platform panelindeki Duraklat düğmesi Control.paused'u
// true yapar — worker HER turdan önce bu bayrağı taze okur.
import { prisma } from "../lib/server/prisma";
import { flattenCurriculum, type FlattenedSubtopic } from "../lib/server/xray/question-generation/curriculum-flatten";
import { callChatCompletion } from "../lib/server/xray/question-generation/ai-client";
import { SYSTEM_PROMPT, buildRound1UserPrompt, buildRoundNUserPrompt, buildRetryCorrectionSuffix } from "../lib/server/xray/question-generation/prompt";
import { validateRoundResponse } from "../lib/server/xray/question-generation/validate-round";
import { slugifyTestName } from "../lib/server/xray/question-pool-upload";

const SUBJECT = "Matematik";
const MODEL = "deepseek-v4-flash-0731";
const MAX_TOKENS = 16000;
const MAX_ATTEMPTS_PER_ROUND = 3;
const DEFAULT_TARGET_ROUNDS = 10;

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const found = args.find((a) => a.startsWith(`--${flag}=`));
    return found ? Number(found.split("=")[1]) : undefined;
  };
  return { subtopicsLimit: get("subtopics"), roundsOverride: get("rounds") };
}

async function getControl() {
  let control = await prisma.xrayPoolGenerationControl.findUnique({ where: { id: "singleton" } });
  if (!control) {
    control = await prisma.xrayPoolGenerationControl.create({ data: { id: "singleton" } });
  }
  const dayMs = 24 * 60 * 60 * 1000;
  if (Date.now() - control.budgetResetAt.getTime() > dayMs) {
    control = await prisma.xrayPoolGenerationControl.update({
      where: { id: "singleton" },
      data: { tokensUsedToday: 0, budgetResetAt: new Date() },
    });
  }
  return control;
}

async function recordTokenUsage(tokens: number) {
  await prisma.xrayPoolGenerationControl.update({
    where: { id: "singleton" },
    data: { tokensUsedToday: { increment: tokens }, tokensUsedTotal: { increment: tokens } },
  });
}

async function getLockedBlueprint(subject: string, subtopicId: string): Promise<string[] | null> {
  const round1 = await prisma.xrayPoolGenerationRound.findUnique({
    where: { subject_subtopicId_roundNumber: { subject, subtopicId, roundNumber: 1 } },
  });
  if (round1?.status === "success" && round1.blueprint) return round1.blueprint as string[];
  return null;
}

async function generateRound(subtopic: FlattenedSubtopic, roundNumber: number, lockedBlueprint: string[] | null) {
  let totalTokens = 0;
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_ROUND; attempt++) {
    const basePrompt = roundNumber === 1 ? buildRound1UserPrompt(subtopic) : buildRoundNUserPrompt(subtopic, lockedBlueprint!, roundNumber);
    const userPrompt = attempt === 1 ? basePrompt : basePrompt + buildRetryCorrectionSuffix(lastError);

    const completion = await callChatCompletion({ model: MODEL, systemPrompt: SYSTEM_PROMPT, userPrompt, maxTokens: MAX_TOKENS });
    totalTokens += completion.totalTokens;

    const validation = validateRoundResponse(completion.content, lockedBlueprint);
    if (validation.ok) return { ok: true as const, questions: validation.questions, blueprint: validation.blueprint, tokensUsed: totalTokens, attempts: attempt };

    lastError = validation.errorSummary;
    console.log(`    ⚠️ Deneme ${attempt}/${MAX_ATTEMPTS_PER_ROUND} başarısız: ${lastError}`);
  }
  return { ok: false as const, errorSummary: lastError, tokensUsed: totalTokens, attempts: MAX_ATTEMPTS_PER_ROUND };
}

async function main() {
  const { subtopicsLimit, roundsOverride } = parseArgs();
  const targetRounds = roundsOverride ?? DEFAULT_TARGET_ROUNDS;
  let subtopics = flattenCurriculum(SUBJECT);
  if (subtopicsLimit) subtopics = subtopics.slice(0, subtopicsLimit);

  console.log(`Worker başladı — ${subtopics.length} alt konu, hedef ${targetRounds} tur/konu, model: ${MODEL}`);

  for (const subtopic of subtopics) {
    for (let roundNumber = 1; roundNumber <= targetRounds; roundNumber++) {
      const control = await getControl();
      if (control.paused) {
        console.log("⏸️  Control.paused=true — worker durduruluyor.");
        return;
      }
      if (control.tokensUsedToday >= control.dailyTokenBudget) {
        console.log(`⏸️  Günlük token bütçesi doldu (${control.tokensUsedToday}/${control.dailyTokenBudget}) — worker durduruluyor.`);
        return;
      }

      const existing = await prisma.xrayPoolGenerationRound.findUnique({
        where: { subject_subtopicId_roundNumber: { subject: SUBJECT, subtopicId: subtopic.subtopicId, roundNumber } },
      });
      if (existing?.status === "success") {
        console.log(`↷ ${subtopic.subtopicName} tur ${roundNumber} zaten tamam, atlanıyor.`);
        continue;
      }

      let lockedBlueprint: string[] | null = null;
      if (roundNumber > 1) {
        lockedBlueprint = await getLockedBlueprint(SUBJECT, subtopic.subtopicId);
        if (!lockedBlueprint) {
          console.log(`⏭️  ${subtopic.subtopicName}: 1. tur başarılı değil, ${roundNumber}. tur atlanıyor.`);
          break;
        }
      }

      console.log(`▶ ${subtopic.grade}.sınıf > ${subtopic.topicName} > ${subtopic.subtopicName} — Tur ${roundNumber}/${targetRounds}`);
      const result = await generateRound(subtopic, roundNumber, lockedBlueprint);
      await recordTokenUsage(result.tokensUsed);

      if (result.ok) {
        const testId = slugifyTestName(`${subtopic.subtopicId}-tur-${roundNumber}`);
        const testName = `${subtopic.subtopicName} — Havuz Turu ${roundNumber}`;
        await prisma.$transaction([
          prisma.xrayPracticeQuestion.deleteMany({ where: { testId } }),
          prisma.xrayPracticeQuestion.createMany({
            data: result.questions.map((q) => ({
              subject: SUBJECT,
              subtopicId: subtopic.subtopicId,
              testId,
              testName,
              order: q.soruNo!,
              kazanimId: q.kazanimId!.trim(),
              prompt: q.questionText!.trim(),
              correctAnswer: q.finalAnswer!.trim(),
              solution: q.detailedSolution!.trim(),
              checks: q.diagnosticComment!.trim(),
            })),
          }),
          prisma.xrayPoolGenerationRound.upsert({
            where: { subject_subtopicId_roundNumber: { subject: SUBJECT, subtopicId: subtopic.subtopicId, roundNumber } },
            create: { subject: SUBJECT, subtopicId: subtopic.subtopicId, roundNumber, status: "success", blueprint: result.blueprint, testId, attempts: result.attempts, tokensUsed: result.tokensUsed },
            update: { status: "success", blueprint: result.blueprint, testId, attempts: result.attempts, tokensUsed: result.tokensUsed, errorMessage: null },
          }),
        ]);
        console.log(`  ✅ Tur ${roundNumber} yazıldı (${result.tokensUsed} token, ${result.attempts} deneme).`);
      } else {
        await prisma.xrayPoolGenerationRound.upsert({
          where: { subject_subtopicId_roundNumber: { subject: SUBJECT, subtopicId: subtopic.subtopicId, roundNumber } },
          create: { subject: SUBJECT, subtopicId: subtopic.subtopicId, roundNumber, status: "failed", attempts: result.attempts, tokensUsed: result.tokensUsed, errorMessage: result.errorSummary },
          update: { status: "failed", attempts: result.attempts, tokensUsed: result.tokensUsed, errorMessage: result.errorSummary },
        });
        console.log(`  ❌ Tur ${roundNumber} başarısız (${result.attempts} deneme sonrası): ${result.errorSummary}`);
      }
    }
  }

  console.log("Worker tamamlandı (tüm alt konular/turlar işlendi).");
}

main()
  .catch((err) => {
    console.error("Worker hata ile durdu:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
