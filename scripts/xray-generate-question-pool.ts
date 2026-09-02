// Faz Z3/Z4/Z5/Z9/Z10 — Akademik Röntgen soru havuzu otomasyon worker'ı.
// Vercel'de DEĞİL, uzun süre çalışan bir arka plan süreci olarak
// çalıştırılır:
//   npx tsx --env-file=.env.local scripts/xray-generate-question-pool.ts
// İsteğe bağlı test bayrakları: --topics=N ("genel" için ilk N konuyla
// sınırla), --subtopics=N ("alt_konu" için ilk N alt konuyla sınırla),
// --rounds=N (hedef tur sayısını geçici olarak değiştir).
//
// Durum TAMAMEN DB'de tutulur (XrayPoolGenerationRound/Control) — bu yüzden
// süreç kesintiye uğrarsa (Ctrl+C, ağ hatası, makine uykuya dalması) yeniden
// çalıştırıldığında zaten "success" olan turları ATLAR, kaldığı yerden
// devam eder. /platform panelindeki Duraklat düğmesi Control.paused'u
// true yapar — worker HER turdan önce bu bayrağı taze okur.
//
// Faz Z10 — KALİTE MİMARİSİ (kullanıcı talebi: "sorunu azaltan kaliteyi
// arttıran her tekniği kullan"), toplamda 8 teknik:
//   1. Deterministik cevap-tutarlılık kontrolü (deterministic-checks.ts) —
//      ÜCRETSİZ, AI çağrısı olmadan finalAnswer/detailedSolution sayısal
//      tutarsızlığını yakalar.
//   2. Deterministik LaTeX/format sağlık kontrolü — ücretsiz.
//   3. Düşürülmüş üretim sıcaklığı (0.8→0.5, bkz. ai-client.ts).
//   4. "Bağımsız çözüm önce" doğrulama tekniği (bkz. verify-content.ts) —
//      çapalama önyargısını azaltır.
//   5. Çapraz-model doğrulama — üretimden FARKLI bir model ailesi
//      (VERIFY_MODEL) doğrulama yapar, aynı modelin kör noktalarını
//      paylaşma riskini azaltır.
//   6. Hedefli düzeltme (SADECE hatalı soruyu yeniden yazdırma, bkz.
//      fixFlaggedQuestions) — tam tur yeniden üretimi yerine.
//   7. Tekrarlanan düzeltme başarısızlığında "farklı yaklaşım" enjeksiyonu
//      (bkz. buildFixUserPrompt isRetry).
//   8. Kalıcı QA sorun günlüğü (XrayPoolQaIssueLog) — her tespit edilen
//      sorun (deterministik veya AI, düzeltilmiş olsa bile) kalıcı olarak
//      loglanır, zamanla kalıp analizine izin verir.
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
import { checkAnswerConsistency, checkFormatHealth, checkArithmeticSteps, checkCrossRoundDuplication } from "../lib/server/xray/question-generation/deterministic-checks";
import { slugifyTestName } from "../lib/server/xray/question-pool-upload";

const SUBJECT = "Matematik";
const MODEL = "deepseek-v4-flash-0731";
// Faz Z10 teknik 5 — doğrulama BİLEREK üretimden FARKLI bir model
// ailesiyle yapılır (qwen ailesi vs deepseek ailesi) — aynı modelin kendi
// hatasını "doğru" görme riskini (kör nokta paylaşımı) azaltır.
const VERIFY_MODEL = "qwen3.8-flash";
const MAX_TOKENS = 16000;
const VERIFY_MAX_TOKENS = 4000;
const MAX_ATTEMPTS_PER_ROUND = 3;
const MAX_FIX_ATTEMPTS = 2;
const DEFAULT_TARGET_ROUNDS = 10;
// Faz Z17 — kullanıcı geri bildirimi: "sistem soru üretmediği zaman çok
// zaman kaybı yaşıyor aynı zamanda acayip fazla token yiyor". Gözlenen
// gerçek örnekler: doğal çeşitlilik sınırına dayanmış bir tur, 3 tam
// deneme × her denemede 2 düzeltme denemesi üst üste binerek 67K-106K
// token yakıp SIFIR kullanılabilir çıktı üretmişti. Bu üst sınır, bir tur
// henüz başarılı olmadan bu kadar token harcamışsa kalan denemeleri
// (2. veya 3. tam deneme) ATLAYIP hemen "başarısız" sayar — "doğal
// sınırda dur" politikasıyla (bkz. runVariantGenel/AltKonu) birleşince bu,
// tükenmiş bir birimde harcanan token'ı öngörülebilir bir tavana sabitler.
const MAX_TOKENS_PER_ROUND_ATTEMPT_BUDGET = 45_000;

// Bu worker'ın gerçekten prompt'u yazılmış variant'ları — Control.
// activeVariants'ta olup burada OLMAYAN bir variant varsa (örn. ileride
// DB'ye elle eklenirse) worker hatayla DURMAZ, sadece loglayıp atlar (bkz.
// aşağıdaki filtre kullanımı).
const IMPLEMENTED_VARIANTS = new Set(["genel", "alt_konu"]);

type FixableQuestion = { soruNo: number; kazanimId: string; questionText: string; finalAnswer: string; detailedSolution: string; diagnosticComment: string };
type LoggedIssue = { soruNo: number; source: "deterministic" | "ai-verify" | "ai-recheck"; reason: string };

// Faz Z10 teknik 1+2+4+5 — deterministik (ücretsiz) kontroller + AI
// (çapraz-model, bağımsız-çözüm) denetimi birleştirilir. Deterministik
// bulgular %100 güvenilir olduğu için AI "temiz" dese bile ATLANMAZ.
async function runContentChecks(
  questions: { soruNo: number; questionText: string; finalAnswer: string; detailedSolution: string }[],
  recheckPass: boolean,
  priorRoundsQuestions: { soruNo: number; questionText: string }[][] = [],
): Promise<{ ok: true; tokensUsed: number; logged: LoggedIssue[] } | { ok: false; issues: VerificationIssue[]; tokensUsed: number; logged: LoggedIssue[] }> {
  const deterministic = [
    ...checkAnswerConsistency(questions),
    ...checkFormatHealth(questions),
    ...checkArithmeticSteps(questions),
    ...checkCrossRoundDuplication(questions, priorRoundsQuestions),
  ];
  const aiCheck = await verifyContent(VERIFY_MODEL, VERIFY_MAX_TOKENS, questions);
  const tokensUsed = aiCheck.tokensUsed;
  const aiSource = recheckPass ? ("ai-recheck" as const) : ("ai-verify" as const);

  const logged: LoggedIssue[] = [...deterministic.map((i) => ({ soruNo: i.soruNo, source: "deterministic" as const, reason: i.reason }))];
  if (aiCheck.ok === false) logged.push(...aiCheck.issues.map((i) => ({ soruNo: i.soruNo, source: aiSource, reason: i.reason })));

  const bySoruNo = new Map<number, VerificationIssue>();
  for (const i of deterministic) bySoruNo.set(i.soruNo, i);
  if (aiCheck.ok === false) for (const i of aiCheck.issues) if (!bySoruNo.has(i.soruNo)) bySoruNo.set(i.soruNo, i);

  if (bySoruNo.size > 0) return { ok: false, issues: [...bySoruNo.values()], tokensUsed, logged };
  if (aiCheck.ok === "check-failed") return { ok: false, issues: [{ soruNo: -1, reason: `AI denetimi başarısız oldu: ${aiCheck.errorSummary}` }], tokensUsed, logged };
  return { ok: true, tokensUsed, logged };
}

async function persistQaLog(subject: string, variant: string, unitId: string, roundNumber: number, issues: LoggedIssue[], resolved: boolean) {
  if (issues.length === 0) return;
  await prisma.xrayPoolQaIssueLog.createMany({
    data: issues.map((i) => ({ subject, variant, unitId, roundNumber, soruNo: i.soruNo, source: i.source, reason: i.reason, resolved })),
  });
}

// Faz Z9 — kullanıcı talebi: "hatalı sorudan dolayı baştan yapması sadece
// hatalı olan soruyu düzeltsin". İçerik denetimi bir turun 30/10 sorusundan
// sadece 1-2'sini "sorunlu" bulsa bile önceden TÜM tur sıfırdan yeniden
// üretiliyordu — hem israf hem de zaten doğru olan soruların bir daha
// üretilip denetlenmesi anlamsızdı. Bu fonksiyon SADECE flawed soruların
// İÇERİĞİNİ yeniden yazdırır, soruNo/kazanımId/subtopicId (blueprint
// yapısı) ASLA değişmez. Düzeltilen sorular tekrar (SADECE kendileri)
// içerik denetiminden geçer — düzeltme kendisi de hatalıysa
// MAX_FIX_ATTEMPTS'e kadar, 2. denemeden itibaren "farklı yaklaşım"
// talimatıyla (Faz Z10 teknik 7) tekrar dener.
async function fixFlaggedQuestions<Q extends FixableQuestion>(
  questions: Q[],
  issues: VerificationIssue[],
  subtopicNameBySoruNo: Map<number, string> | null,
  priorRoundsQuestions: { soruNo: number; questionText: string }[][] = [],
): Promise<{ ok: true; questions: Q[]; tokensUsed: number; logged: LoggedIssue[] } | { ok: false; tokensUsed: number; logged: LoggedIssue[] }> {
  let current = questions;
  let remainingIssues = issues.filter((i) => i.soruNo >= 0 && current.some((q) => q.soruNo === i.soruNo));
  let tokensUsed = 0;
  const logged: LoggedIssue[] = [];
  if (remainingIssues.length === 0) return { ok: false, tokensUsed, logged };

  for (let fixAttempt = 1; fixAttempt <= MAX_FIX_ATTEMPTS; fixAttempt++) {
    const flawed: FlawedQuestionContext[] = remainingIssues.map((issue) => {
      const q = current.find((x) => x.soruNo === issue.soruNo)!;
      return { soruNo: q.soruNo, kazanimId: q.kazanimId, subtopicName: subtopicNameBySoruNo?.get(q.soruNo), oldQuestionText: q.questionText, reason: issue.reason };
    });
    console.log(`    🔧 Hedefli düzeltme ${fixAttempt}/${MAX_FIX_ATTEMPTS} — ${flawed.length} soru: ${flawed.map((f) => f.soruNo).join(",")}`);

    const fixCompletion = await callChatCompletion({ model: MODEL, systemPrompt: SYSTEM_PROMPT_FIX, userPrompt: buildFixUserPrompt(flawed, fixAttempt > 1, priorRoundsQuestions), maxTokens: MAX_TOKENS, temperature: 0.5 });
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
    const recheck = await runContentChecks(toRecheck, true, priorRoundsQuestions);
    tokensUsed += recheck.tokensUsed;
    logged.push(...recheck.logged);
    if (recheck.ok === true) return { ok: true, questions: current, tokensUsed, logged };
    remainingIssues = recheck.issues;
    console.log(`    ⚠️ Düzeltme sonrası hâlâ sorunlu: ${remainingIssues.map((i) => `soruNo ${i.soruNo}: ${i.reason}`).join(" | ")}`);
  }
  return { ok: false, tokensUsed, logged };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const found = args.find((a) => a.startsWith(`--${flag}=`));
    return found ? Number(found.split("=")[1]) : undefined;
  };
  return { topicsLimit: get("topics"), subtopicsLimit: get("subtopics"), roundsOverride: get("rounds"), maxGrade: get("maxGrade") };
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

// Faz Z12 — turlar arası çeşitlilik kontrolü (checkCrossRoundDuplication)
// için, ÖNCEKİ BAŞARILI turların questionText'lerini DB'den çeker. Round
// 1'de boş dizi döner (karşılaştıracak önceki tur yok).
async function getPriorRoundsQuestions(variant: string, unitId: string, currentRoundNumber: number): Promise<{ soruNo: number; questionText: string }[][]> {
  if (currentRoundNumber <= 1) return [];
  const priorRounds = await prisma.xrayPoolGenerationRound.findMany({
    where: { subject: SUBJECT, variant, unitId, roundNumber: { lt: currentRoundNumber }, status: "success" },
    select: { testId: true },
  });
  const result: { soruNo: number; questionText: string }[][] = [];
  for (const r of priorRounds) {
    if (!r.testId) continue;
    const qs = await prisma.xrayPracticeQuestion.findMany({ where: { testId: r.testId }, select: { order: true, prompt: true } });
    result.push(qs.map((q) => ({ soruNo: q.order, questionText: q.prompt })));
  }
  return result;
}

// ── "genel" — 30 soru, tema tümü ──

async function generateGenelRound(topic: FlattenedTopic, roundNumber: number, lockedBlueprint: GenelBlueprintSlot[] | null) {
  let totalTokens = 0;
  let lastError = "";
  const allLogged: LoggedIssue[] = [];
  const priorRoundsQuestions = await getPriorRoundsQuestions("genel", topic.topicId, roundNumber);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_ROUND; attempt++) {
    if (totalTokens >= MAX_TOKENS_PER_ROUND_ATTEMPT_BUDGET) {
      lastError = `Token bütçesi (${MAX_TOKENS_PER_ROUND_ATTEMPT_BUDGET}) aşıldı, kalan denemeler atlanıyor.`;
      console.log(`    ⏱️  Tur token bütçesini aştı (${totalTokens}), ${attempt}. denemeden itibaren atlanıyor.`);
      break;
    }
    const basePrompt = roundNumber === 1 ? buildGenelRound1UserPrompt(topic) : buildGenelRoundNUserPrompt(topic, lockedBlueprint!, roundNumber, priorRoundsQuestions);
    const userPrompt = attempt === 1 ? basePrompt : basePrompt + buildRetryCorrectionSuffix(lastError);
    const completion = await callChatCompletion({ model: MODEL, systemPrompt: SYSTEM_PROMPT_GENEL, userPrompt, maxTokens: MAX_TOKENS });
    totalTokens += completion.totalTokens;
    const validation = validateGenelRoundResponse(completion.content, topic, lockedBlueprint);
    if (!validation.ok) {
      lastError = validation.errorSummary;
      console.log(`    ⚠️ Deneme ${attempt}/${MAX_ATTEMPTS_PER_ROUND} başarısız (yapısal): ${lastError}`);
      continue;
    }

    const check = await runContentChecks(validation.questions, false, priorRoundsQuestions);
    totalTokens += check.tokensUsed;
    allLogged.push(...check.logged);
    if (check.ok === true) {
      await persistQaLog(SUBJECT, "genel", topic.topicId, roundNumber, allLogged, true);
      return { ok: true as const, questions: validation.questions, blueprint: validation.blueprint, tokensUsed: totalTokens, attempts: attempt };
    }

    const subtopicNameBySoruNo = new Map(validation.questions.map((q) => [q.soruNo, topic.subtopics.find((s) => s.subtopicId === q.subtopicId)?.subtopicName ?? q.subtopicId]));
    const fixResult = await fixFlaggedQuestions(validation.questions, check.issues, subtopicNameBySoruNo, priorRoundsQuestions);
    totalTokens += fixResult.tokensUsed;
    allLogged.push(...fixResult.logged);
    if (fixResult.ok) {
      await persistQaLog(SUBJECT, "genel", topic.topicId, roundNumber, allLogged, true);
      return { ok: true as const, questions: fixResult.questions, blueprint: validation.blueprint, tokensUsed: totalTokens, attempts: attempt };
    }
    lastError = `Hedefli düzeltme başarısız oldu (${check.issues.length} soru), tur yeniden üretiliyor.`;
    console.log(`    ⚠️ Deneme ${attempt}/${MAX_ATTEMPTS_PER_ROUND} başarısız (içerik kontrolü): ${lastError}`);
  }
  await persistQaLog(SUBJECT, "genel", topic.topicId, roundNumber, allLogged, false);
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
      // Faz Z14 — kullanıcı kararı: "doğal sınırda dur". Bir tur (bu
      // çalıştırmada veya ÖNCEKİ bir çalıştırmada) başarısız olduysa, bu
      // konunun kazanımları için doğal çeşitlilik alanı tükenmiş demektir —
      // aynı turu (veya sonraki turları) tekrar tekrar denemek sadece token
      // israf eder (canlı üretimde 2 ardışık başarısız tur ~188K token
      // yaktı, sıfır kullanılabilir çıktı). O ana kadarki başarılı turlarla
      // yetinilip bu konu için üretim durdurulur.
      if (existing?.status === "failed") {
        console.log(`⏹️  [genel] ${topic.topicName}: tur ${roundNumber} daha önce başarısız olmuştu (doğal çeşitlilik sınırı) — bu konu için üretim durduruluyor, mevcut ${roundNumber - 1} tur ile yetiniliyor.`);
        break;
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
      if (!result.ok) {
        console.log(`⏹️  [genel] ${topic.topicName}: tur ${roundNumber} başarısız oldu (doğal çeşitlilik sınırına ulaşılmış olabilir) — bu konu için üretim durduruluyor, mevcut ${roundNumber - 1} tur ile yetiniliyor.`);
        break;
      }
    }
  }
  return "continue";
}

// ── "alt_konu" — 10 soru, tek alt konu, orta seviye ──

async function generateAltKonuRound(subtopic: FlattenedSubtopic, roundNumber: number, lockedBlueprint: string[] | null) {
  let totalTokens = 0;
  let lastError = "";
  const allLogged: LoggedIssue[] = [];
  const priorRoundsQuestions = await getPriorRoundsQuestions("alt_konu", subtopic.subtopicId, roundNumber);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_ROUND; attempt++) {
    if (totalTokens >= MAX_TOKENS_PER_ROUND_ATTEMPT_BUDGET) {
      lastError = `Token bütçesi (${MAX_TOKENS_PER_ROUND_ATTEMPT_BUDGET}) aşıldı, kalan denemeler atlanıyor.`;
      console.log(`    ⏱️  Tur token bütçesini aştı (${totalTokens}), ${attempt}. denemeden itibaren atlanıyor.`);
      break;
    }
    const basePrompt = roundNumber === 1 ? buildAltKonuRound1UserPrompt(subtopic) : buildAltKonuRoundNUserPrompt(subtopic, lockedBlueprint!, roundNumber, priorRoundsQuestions);
    const userPrompt = attempt === 1 ? basePrompt : basePrompt + buildRetryCorrectionSuffix(lastError);
    const completion = await callChatCompletion({ model: MODEL, systemPrompt: SYSTEM_PROMPT_ALT_KONU, userPrompt, maxTokens: MAX_TOKENS });
    totalTokens += completion.totalTokens;
    const validation = validateAltKonuRoundResponse(completion.content, lockedBlueprint);
    if (!validation.ok) {
      lastError = validation.errorSummary;
      console.log(`    ⚠️ Deneme ${attempt}/${MAX_ATTEMPTS_PER_ROUND} başarısız (yapısal): ${lastError}`);
      continue;
    }

    const check = await runContentChecks(validation.questions, false, priorRoundsQuestions);
    totalTokens += check.tokensUsed;
    allLogged.push(...check.logged);
    if (check.ok === true) {
      await persistQaLog(SUBJECT, "alt_konu", subtopic.subtopicId, roundNumber, allLogged, true);
      const questions = validation.questions.map((q) => ({ ...q, subtopicId: subtopic.subtopicId }));
      return { ok: true as const, questions, blueprint: validation.blueprint, tokensUsed: totalTokens, attempts: attempt };
    }

    const fixResult = await fixFlaggedQuestions(validation.questions, check.issues, null, priorRoundsQuestions);
    totalTokens += fixResult.tokensUsed;
    allLogged.push(...fixResult.logged);
    if (fixResult.ok) {
      await persistQaLog(SUBJECT, "alt_konu", subtopic.subtopicId, roundNumber, allLogged, true);
      const questions = fixResult.questions.map((q) => ({ ...q, subtopicId: subtopic.subtopicId }));
      return { ok: true as const, questions, blueprint: validation.blueprint, tokensUsed: totalTokens, attempts: attempt };
    }
    lastError = `Hedefli düzeltme başarısız oldu (${check.issues.length} soru), tur yeniden üretiliyor.`;
    console.log(`    ⚠️ Deneme ${attempt}/${MAX_ATTEMPTS_PER_ROUND} başarısız (içerik kontrolü): ${lastError}`);
  }
  await persistQaLog(SUBJECT, "alt_konu", subtopic.subtopicId, roundNumber, allLogged, false);
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
      // Faz Z14 — "doğal sınırda dur" (bkz. runVariantGenel'deki aynı mantık).
      if (existing?.status === "failed") {
        console.log(`⏹️  [alt_konu] ${subtopic.subtopicName}: tur ${roundNumber} daha önce başarısız olmuştu (doğal çeşitlilik sınırı) — bu alt konu için üretim durduruluyor, mevcut ${roundNumber - 1} tur ile yetiniliyor.`);
        break;
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
      if (!result.ok) {
        console.log(`⏹️  [alt_konu] ${subtopic.subtopicName}: tur ${roundNumber} başarısız oldu (doğal çeşitlilik sınırına ulaşılmış olabilir) — bu alt konu için üretim durduruluyor, mevcut ${roundNumber - 1} tur ile yetiniliyor.`);
        break;
      }
    }
  }
  return "continue";
}

async function main() {
  const { topicsLimit, subtopicsLimit, roundsOverride, maxGrade } = parseArgs();
  const targetRounds = roundsOverride ?? DEFAULT_TARGET_ROUNDS;
  let topics = flattenTopics(SUBJECT);
  if (maxGrade) topics = topics.filter((t) => t.grade <= maxGrade);
  if (topicsLimit) topics = topics.slice(0, topicsLimit);
  let subtopics = flattenCurriculum(SUBJECT);
  if (maxGrade) subtopics = subtopics.filter((s) => s.grade <= maxGrade);
  if (subtopicsLimit) subtopics = subtopics.slice(0, subtopicsLimit);
  if (maxGrade) console.log(`ℹ️  --maxGrade=${maxGrade} — bu sınıf seviyesinin ÜSTÜNDEKİ konular bu çalıştırmada işlenmeyecek.`);

  const control = await getControl();
  const activeVariants = (control.activeVariants as unknown as string[]).filter((v) => IMPLEMENTED_VARIANTS.has(v));
  const skipped = (control.activeVariants as unknown as string[]).filter((v) => !IMPLEMENTED_VARIANTS.has(v));
  if (skipped.length > 0) console.log(`ℹ️  Şu variant'ların prompt'u henüz yok, atlanıyor: ${skipped.join(", ")}`);

  console.log(`Worker başladı — üretim: ${MODEL}, doğrulama: ${VERIFY_MODEL}, hedef ${targetRounds} tur/birim, aktif variant'lar: ${activeVariants.join(", ") || "(yok)"}`);

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
