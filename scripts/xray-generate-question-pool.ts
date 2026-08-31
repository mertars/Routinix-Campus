// Faz Z3/Z4 — Akademik Röntgen soru havuzu otomasyon worker'ı. Vercel'de
// DEĞİL, uzun süre çalışan bir arka plan süreci olarak çalıştırılır:
//   npx tsx --env-file=.env.local scripts/xray-generate-question-pool.ts
// İsteğe bağlı test bayrakları: --topics=N (ilk N konuyla sınırla),
// --rounds=N (konu başına hedef tur sayısını geçici olarak değiştir).
//
// Şu an SADECE "genel" variant'ı (konunun/temanın TÜMÜNÜ kapsayan 30
// soruluk havuz) uygulanmış durumda — "alt_konu" (10 soru/tek alt konu) ve
// "yeterlilik" (20 soru/zor) prompt'ları henüz tasarlanmadı (kullanıcının
// kendi sıralaması: "bunları yap sonrasında diğer 2 promptu belirleyelim").
// Control.activeVariants'ta "alt_konu"/"yeterlilik" aktif olsa bile worker
// bunlar için prompt bulamayınca sadece loglar, atlar — asla hatayla durmaz.
//
// Durum TAMAMEN DB'de tutulur (XrayPoolGenerationRound/Control) — bu yüzden
// süreç kesintiye uğrarsa (Ctrl+C, ağ hatası, makine uykuya dalması) yeniden
// çalıştırıldığında zaten "success" olan turları ATLAR, kaldığı yerden
// devam eder. /platform panelindeki Duraklat düğmesi Control.paused'u
// true yapar — worker HER turdan önce bu bayrağı taze okur.
import { prisma } from "../lib/server/prisma";
import { flattenTopics, type FlattenedTopic } from "../lib/server/xray/question-generation/curriculum-flatten";
import { callChatCompletion } from "../lib/server/xray/question-generation/ai-client";
import { SYSTEM_PROMPT_GENEL, buildGenelRound1UserPrompt, buildGenelRoundNUserPrompt, buildRetryCorrectionSuffix } from "../lib/server/xray/question-generation/prompt";
import { validateGenelRoundResponse, type GenelBlueprintSlot } from "../lib/server/xray/question-generation/validate-round";
import { slugifyTestName } from "../lib/server/xray/question-pool-upload";

const SUBJECT = "Matematik";
const MODEL = "deepseek-v4-flash-0731";
const MAX_TOKENS = 16000;
const MAX_ATTEMPTS_PER_ROUND = 3;
const DEFAULT_TARGET_ROUNDS = 10;

// Şimdilik sadece "genel" implemente edildi — diğer variant'lar prompt'ları
// tasarlanınca buraya eklenecek.
const IMPLEMENTED_VARIANTS = new Set(["genel"]);

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const found = args.find((a) => a.startsWith(`--${flag}=`));
    return found ? Number(found.split("=")[1]) : undefined;
  };
  return { topicsLimit: get("topics"), roundsOverride: get("rounds") };
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

async function getLockedBlueprint(variant: string, unitId: string): Promise<GenelBlueprintSlot[] | null> {
  const round1 = await prisma.xrayPoolGenerationRound.findUnique({ where: { subject_variant_unitId_roundNumber: { subject: SUBJECT, variant, unitId, roundNumber: 1 } } });
  if (round1?.status === "success" && round1.blueprint) return round1.blueprint as unknown as GenelBlueprintSlot[];
  return null;
}

async function generateGenelRound(topic: FlattenedTopic, roundNumber: number, lockedBlueprint: GenelBlueprintSlot[] | null) {
  let totalTokens = 0;
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_ROUND; attempt++) {
    const basePrompt = roundNumber === 1 ? buildGenelRound1UserPrompt(topic) : buildGenelRoundNUserPrompt(topic, lockedBlueprint!, roundNumber);
    const userPrompt = attempt === 1 ? basePrompt : basePrompt + buildRetryCorrectionSuffix(lastError);

    const completion = await callChatCompletion({ model: MODEL, systemPrompt: SYSTEM_PROMPT_GENEL, userPrompt, maxTokens: MAX_TOKENS });
    totalTokens += completion.totalTokens;

    const validation = validateGenelRoundResponse(completion.content, topic, lockedBlueprint);
    if (validation.ok) return { ok: true as const, questions: validation.questions, blueprint: validation.blueprint, tokensUsed: totalTokens, attempts: attempt };

    lastError = validation.errorSummary;
    console.log(`    ⚠️ Deneme ${attempt}/${MAX_ATTEMPTS_PER_ROUND} başarısız: ${lastError}`);
  }
  return { ok: false as const, errorSummary: lastError, tokensUsed: totalTokens, attempts: MAX_ATTEMPTS_PER_ROUND };
}

async function runVariantGenel(topics: FlattenedTopic[], targetRounds: number): Promise<"continue" | "stop"> {
  for (const topic of topics) {
    for (let roundNumber = 1; roundNumber <= targetRounds; roundNumber++) {
      const control = await getControl();
      if (control.paused) {
        console.log("⏸️  Control.paused=true — worker durduruluyor.");
        return "stop";
      }
      if (control.tokensUsedToday >= control.dailyTokenBudget) {
        console.log(`⏸️  Günlük token bütçesi doldu (${control.tokensUsedToday}/${control.dailyTokenBudget}) — worker durduruluyor.`);
        return "stop";
      }
      const activeVariants = control.activeVariants as unknown as string[];
      if (!activeVariants.includes("genel")) return "continue";

      const existing = await prisma.xrayPoolGenerationRound.findUnique({
        where: { subject_variant_unitId_roundNumber: { subject: SUBJECT, variant: "genel", unitId: topic.topicId, roundNumber } },
      });
      if (existing?.status === "success") {
        console.log(`↷ [genel] ${topic.topicName} tur ${roundNumber} zaten tamam, atlanıyor.`);
        continue;
      }

      let lockedBlueprint: GenelBlueprintSlot[] | null = null;
      if (roundNumber > 1) {
        lockedBlueprint = await getLockedBlueprint("genel", topic.topicId);
        if (!lockedBlueprint) {
          console.log(`⏭️  [genel] ${topic.topicName}: 1. tur başarılı değil, ${roundNumber}. tur atlanıyor.`);
          break;
        }
      }

      console.log(`▶ [genel] ${topic.grade}.sınıf > ${topic.topicName} — Tur ${roundNumber}/${targetRounds}`);
      const result = await generateGenelRound(topic, roundNumber, lockedBlueprint);
      await recordTokenUsage(result.tokensUsed);

      if (result.ok) {
        const testId = slugifyTestName(`genel-${topic.topicId}-tur-${roundNumber}`);
        const testName = `${topic.topicName} — Genel Havuz Turu ${roundNumber}`;
        await prisma.$transaction([
          prisma.xrayPracticeQuestion.deleteMany({ where: { testId } }),
          prisma.xrayPracticeQuestion.createMany({
            data: result.questions.map((q) => ({
              subject: SUBJECT,
              subtopicId: q.subtopicId,
              variant: "genel",
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
            where: { subject_variant_unitId_roundNumber: { subject: SUBJECT, variant: "genel", unitId: topic.topicId, roundNumber } },
            create: { subject: SUBJECT, variant: "genel", unitId: topic.topicId, roundNumber, status: "success", blueprint: result.blueprint, testId, attempts: result.attempts, tokensUsed: result.tokensUsed },
            update: { status: "success", blueprint: result.blueprint, testId, attempts: result.attempts, tokensUsed: result.tokensUsed, errorMessage: null },
          }),
        ]);
        console.log(`  ✅ Tur ${roundNumber} yazıldı (${result.questions.length} soru, ${result.tokensUsed} token, ${result.attempts} deneme).`);
      } else {
        await prisma.xrayPoolGenerationRound.upsert({
          where: { subject_variant_unitId_roundNumber: { subject: SUBJECT, variant: "genel", unitId: topic.topicId, roundNumber } },
          create: { subject: SUBJECT, variant: "genel", unitId: topic.topicId, roundNumber, status: "failed", attempts: result.attempts, tokensUsed: result.tokensUsed, errorMessage: result.errorSummary },
          update: { status: "failed", attempts: result.attempts, tokensUsed: result.tokensUsed, errorMessage: result.errorSummary },
        });
        console.log(`  ❌ Tur ${roundNumber} başarısız (${result.attempts} deneme sonrası): ${result.errorSummary}`);
      }
    }
  }
  return "continue";
}

async function main() {
  const { topicsLimit, roundsOverride } = parseArgs();
  const targetRounds = roundsOverride ?? DEFAULT_TARGET_ROUNDS;
  let topics = flattenTopics(SUBJECT);
  if (topicsLimit) topics = topics.slice(0, topicsLimit);

  const control = await getControl();
  const activeVariants = (control.activeVariants as unknown as string[]).filter((v) => IMPLEMENTED_VARIANTS.has(v));
  const skipped = (control.activeVariants as unknown as string[]).filter((v) => !IMPLEMENTED_VARIANTS.has(v));
  if (skipped.length > 0) console.log(`ℹ️  Şu variant'ların prompt'u henüz yok, atlanıyor: ${skipped.join(", ")}`);

  console.log(`Worker başladı — ${topics.length} konu, hedef ${targetRounds} tur/konu, model: ${MODEL}, aktif variant'lar: ${activeVariants.join(", ") || "(yok)"}`);

  if (activeVariants.includes("genel")) {
    const outcome = await runVariantGenel(topics, targetRounds);
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
