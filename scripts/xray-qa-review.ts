// Faz C — Akademik Röntgen soru havuzu için arka plan QA denetim worker'ı.
// Vercel'de DEĞİL, uzun süre çalışan bir arka plan süreci olarak çalıştırılır:
//   npx tsx --env-file=.env.local scripts/xray-qa-review.ts
//
// Zaten üretilip DB'ye yazılmış (scripts/xray-generate-question-pool.ts'nin
// ürettiği, generation-time verify-content.ts ile bir kez zaten süzülmüş)
// soru havuzunu, TUR TUR (XrayPoolGenerationRound.testId bazında) İKİNCİ,
// daha titiz bir bağımsız AI geçişiyle (bkz. qa-review-prompt.ts) yeniden
// denetler. Kullanıcı talebi: "en az senin incelediğin kadar detaylı" —
// yani sadece hesap doğruluğu değil, yazım/müfredat/ölçme-değerlendirme/
// diagnosticComment tutarlılığı da kontrol edilir.
//
// Bir sorun bulunduğunda:
//   1. ÖNCE before-snapshot XrayQaFinding'e yazılır (asla üzerine yazmadan
//      önce kaybedilmez — bu oturumda 572 satırlık toplu düzeltmede
//      yaşanan "orijinal metin arşivlenmeden kaybedildi" hatasından ders
//      alınarak KASITLI).
//   2. Var olan SYSTEM_PROMPT_FIX/buildFixUserPrompt (aynı mekanizma,
//      üretim worker'ının hedefli düzeltmesiyle AYNI) ile düzeltme denenir,
//      after-snapshot yazılır, DB satırı güncellenir.
//   3. Kullanıcı talebi ("1 sorun yakaladığında o sorunu TÜM sorularda
//      arasın"): aynı kazanımId'yi paylaşan TÜM DİĞER sorular (hangi
//      turda/ne zaman üretilmiş olursa olsun, zaten denetlenmiş olsalar
//      bile) hedefli bir mini-QA turundan geçirilir — aynı kural/yöntemin
//      başka bir örnekte de yanlış uygulanıp uygulanmadığı kontrol edilir.
//      Bulunan ek örnekler relatedFindingId ile kök bulguya bağlanır.
//
// Durum TAMAMEN DB'de tutulur (XrayQaReviewedRound/Control) — kesintiye
// uğrarsa yeniden başlatıldığında zaten denetlenmiş turları ATLAR.
// /platform panelindeki Duraklat düğmesi XrayQaReviewControl.paused'u
// true yapar — worker HER turdan önce bu bayrağı taze okur.
import { prisma } from "../lib/server/prisma";
import { flattenCurriculum } from "../lib/server/xray/question-generation/curriculum-flatten";
import { callChatCompletion } from "../lib/server/xray/question-generation/ai-client";
import { SYSTEM_PROMPT_FIX, buildFixUserPrompt, type FlawedQuestionContext } from "../lib/server/xray/question-generation/prompt";
import { validateFixResponse } from "../lib/server/xray/question-generation/validate-round";
import { runQaReview, type QaReviewQuestionInput, type QaReviewFinding } from "../lib/server/xray/question-generation/qa-review-prompt";

const SUBJECT = "Matematik";
const REVIEW_MODEL = "deepseek-v4-flash-0731";
const REVIEW_MAX_TOKENS = 24000;
const FIX_MODEL = "deepseek-v4-flash-0731";
const FIX_MAX_TOKENS = 4000;
const BATCH_SIZE = 15; // bir turu (30/10 soru) 2 (veya 1) API çağrısına bölmek — tek çağrıda çok fazla soru = daha düşük dikkat/doğruluk riski
const IDLE_POLL_MS = 5 * 60 * 1000; // tüm turlar denetlendiyse, yeni turlar için 5 dk'da bir tekrar bak

type QaRow = { id: string; testId: string; order: number; kazanimId: string; prompt: string; correctAnswer: string; solution: string; checks: string };

// Kullanıcı talebi: panelde "şurda sorun buldum, bakıyorum, düzelttim, şimdi
// taramaya devam ediyorum" tarzı CANLI Türkçe akış görmek istiyor. Bu
// fonksiyon HER önemli adımda çağrılır, konsola AYNI anda hem log basar hem
// de DB'ye (XrayQaActivityLog) yazar — panel bu tabloyu okuyup gösterir.
async function logActivity(level: "info" | "found" | "fixed" | "manual" | "error", message: string) {
  console.log(message);
  await prisma.xrayQaActivityLog.create({ data: { subject: SUBJECT, level, message } }).catch(() => {});
}

async function getControl() {
  let control = await prisma.xrayQaReviewControl.findUnique({ where: { id: "singleton" } });
  if (!control) control = await prisma.xrayQaReviewControl.create({ data: { id: "singleton" } });
  return control;
}

async function checkGate(): Promise<boolean> {
  const control = await getControl();
  if (control.paused) {
    console.log("⏸️  XrayQaReviewControl.paused=true — QA worker durduruluyor.");
    return false;
  }
  return true;
}

function subtopicContextMap() {
  const rows = flattenCurriculum(SUBJECT);
  return new Map(rows.map((s) => [s.subtopicId, { grade: s.grade, topicName: s.topicName, subtopicName: s.subtopicName }]));
}

async function applyAutoFix(row: QaRow, finding: QaReviewFinding, ctx: { grade: number; topicName: string; subtopicName: string } | undefined): Promise<{ fixed: boolean; after?: { prompt: string; correctAnswer: string; solution: string; checks: string }; tokensUsed: number }> {
  const flawed: FlawedQuestionContext = {
    soruNo: row.order,
    kazanimId: row.kazanimId,
    subtopicName: ctx?.subtopicName,
    oldQuestionText: row.prompt,
    reason: finding.summary,
  };
  const completion = await callChatCompletion({ model: FIX_MODEL, systemPrompt: SYSTEM_PROMPT_FIX, userPrompt: buildFixUserPrompt([flawed]), maxTokens: FIX_MAX_TOKENS, temperature: 0.5 });
  const validation = validateFixResponse(completion.content, [row.order]);
  if (!validation.ok) {
    console.log(`      ⚠️ Otomatik düzeltme başarısız (yanıt geçersiz): ${validation.errorSummary}`);
    return { fixed: false, tokensUsed: completion.totalTokens };
  }
  const fixed = validation.fixed[0];
  const after = { prompt: fixed.questionText, correctAnswer: fixed.finalAnswer, solution: fixed.detailedSolution, checks: fixed.diagnosticComment };
  await prisma.xrayPracticeQuestion.update({ where: { id: row.id }, data: { prompt: after.prompt, correctAnswer: after.correctAnswer, solution: after.solution, checks: after.checks } });
  return { fixed: true, after, tokensUsed: completion.totalTokens };
}

// Kullanıcı talebi: "1 sorun yakaladığında o sorunu tüm sorularda arasın
// hepsinde düzeltsin sonra devam etsin". Aynı kazanımId'yi paylaşan TÜM
// diğer soruları (zaten denetlenmiş turlar dahil) hedefli bir mini-QA
// turundan geçirir.
async function sweepKazanim(kazanimId: string, excludeQuestionId: string, rootFindingId: string, ctxMap: Map<string, { grade: number; topicName: string; subtopicName: string }>) {
  const rows = await prisma.xrayPracticeQuestion.findMany({
    where: { subject: SUBJECT, kazanimId, id: { not: excludeQuestionId } },
    select: { id: true, testId: true, order: true, kazanimId: true, prompt: true, correctAnswer: true, solution: true, checks: true, subtopicId: true },
  });
  if (rows.length === 0) return { tokensUsed: 0, found: 0 };
  await logActivity("info", `🔎 Bu hata başka sorularda da olabilir mi diye "${kazanimId}" kazanımındaki ${rows.length} başka soruyu tarıyorum...`);
  let tokensUsed = 0;
  let found = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const inputs: QaReviewQuestionInput[] = batch.map((r) => {
      const ctx = ctxMap.get(r.subtopicId);
      return { soruNo: r.order, kazanimId: r.kazanimId, grade: ctx?.grade ?? 0, topicName: ctx?.topicName ?? "", subtopicName: ctx?.subtopicName ?? "", questionText: r.prompt, finalAnswer: r.correctAnswer, detailedSolution: r.solution, diagnosticComment: r.checks };
    });
    const result = await runQaReview(REVIEW_MODEL, REVIEW_MAX_TOKENS, inputs);
    tokensUsed += result.tokensUsed;
    if (!result.ok) {
      await logActivity("error", `⚠️ Kazanım taraması başarısız oldu: ${result.errorSummary}`);
      continue;
    }
    for (const finding of result.findings) {
      const row = batch.find((r) => r.order === finding.soruNo);
      if (!row) continue;
      found++;
      const created = await prisma.xrayQaFinding.create({
        data: {
          questionId: row.id,
          testId: row.testId,
          subject: SUBJECT,
          unitId: row.kazanimId,
          soruNo: row.order,
          kazanimId: row.kazanimId,
          category: finding.category,
          severity: finding.severity,
          summary: `[Kazanım-geneli tarama] ${finding.summary}`,
          beforePrompt: row.prompt,
          beforeCorrectAnswer: row.correctAnswer,
          beforeSolution: row.solution,
          beforeChecks: row.checks,
          relatedFindingId: rootFindingId,
        },
      });
      const ctx = ctxMap.get(row.subtopicId);
      const fixResult = await applyAutoFix({ id: row.id, testId: row.testId, order: row.order, kazanimId: row.kazanimId, prompt: row.prompt, correctAnswer: row.correctAnswer, solution: row.solution, checks: row.checks }, finding, ctx);
      tokensUsed += fixResult.tokensUsed;
      if (fixResult.fixed && fixResult.after) {
        await prisma.xrayQaFinding.update({ where: { id: created.id }, data: { status: "fixed", fixedAt: new Date(), afterPrompt: fixResult.after.prompt, afterCorrectAnswer: fixResult.after.correctAnswer, afterSolution: fixResult.after.solution, afterChecks: fixResult.after.checks } });
        await logActivity("fixed", `✅ Aynı kalıptan bir tane daha buldum (${row.testId}, soru ${row.order}) — düzelttim.`);
      } else {
        await prisma.xrayQaFinding.update({ where: { id: created.id }, data: { status: "fix-failed" } });
        await logActivity("manual", `❌ Aynı kalıptan bir tane daha buldum (${row.testId}, soru ${row.order}) ama otomatik düzeltemedim — elle bakılmalı.`);
      }
    }
  }
  if (found === 0) await logActivity("info", `✔️ "${kazanimId}" kazanımında başka örnek bulunmadı, tek seferlikmiş.`);
  return { tokensUsed, found };
}

async function reviewRound(round: { testId: string; subject: string; variant: string; unitId: string; roundNumber: number }, ctxMap: Map<string, { grade: number; topicName: string; subtopicName: string }>) {
  const questions = await prisma.xrayPracticeQuestion.findMany({
    where: { testId: round.testId },
    select: { id: true, testId: true, order: true, kazanimId: true, prompt: true, correctAnswer: true, solution: true, checks: true, subtopicId: true },
    orderBy: { order: "asc" },
  });
  if (questions.length === 0) {
    console.log(`  ↷ testId=${round.testId}: soru bulunamadı, atlanıyor.`);
    return;
  }

  await logActivity("info", `📚 ${round.unitId} — tur ${round.roundNumber} taranıyor (${questions.length} soru)...`);
  let totalTokens = 0;
  let issuesFound = 0;

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);
    const inputs: QaReviewQuestionInput[] = batch.map((q) => {
      const ctx = ctxMap.get(q.subtopicId);
      return { soruNo: q.order, kazanimId: q.kazanimId, grade: ctx?.grade ?? 0, topicName: ctx?.topicName ?? "", subtopicName: ctx?.subtopicName ?? "", questionText: q.prompt, finalAnswer: q.correctAnswer, detailedSolution: q.solution, diagnosticComment: q.checks };
    });
    const result = await runQaReview(REVIEW_MODEL, REVIEW_MAX_TOKENS, inputs);
    totalTokens += result.tokensUsed;
    if (!result.ok) {
      await logActivity("error", `⚠️ Soru ${batch[0].order}-${batch[batch.length - 1].order} arası denetim çağrısı başarısız oldu: ${result.errorSummary}`);
      continue;
    }

    for (const finding of result.findings) {
      const row = batch.find((q) => q.order === finding.soruNo);
      if (!row) continue;
      issuesFound++;
      await logActivity("found", `🚩 ${round.unitId} tur ${round.roundNumber}, soru ${row.order}'de sorun buldum [${finding.category}]: ${finding.summary}`);

      const created = await prisma.xrayQaFinding.create({
        data: {
          questionId: row.id,
          testId: row.testId,
          subject: SUBJECT,
          unitId: round.unitId,
          soruNo: row.order,
          kazanimId: row.kazanimId,
          category: finding.category,
          severity: finding.severity,
          summary: finding.summary,
          beforePrompt: row.prompt,
          beforeCorrectAnswer: row.correctAnswer,
          beforeSolution: row.solution,
          beforeChecks: row.checks,
        },
      });

      const ctx = ctxMap.get(row.subtopicId);
      const fixResult = await applyAutoFix({ id: row.id, testId: row.testId, order: row.order, kazanimId: row.kazanimId, prompt: row.prompt, correctAnswer: row.correctAnswer, solution: row.solution, checks: row.checks }, finding, ctx);
      totalTokens += fixResult.tokensUsed;
      if (fixResult.fixed && fixResult.after) {
        await prisma.xrayQaFinding.update({ where: { id: created.id }, data: { status: "fixed", fixedAt: new Date(), afterPrompt: fixResult.after.prompt, afterCorrectAnswer: fixResult.after.correctAnswer, afterSolution: fixResult.after.solution, afterChecks: fixResult.after.checks } });
        await logActivity("fixed", `✅ Düzelttim — soru ${row.order} artık doğru.`);
      } else {
        await prisma.xrayQaFinding.update({ where: { id: created.id }, data: { status: "fix-failed" } });
        await logActivity("manual", `❌ Soru ${row.order}'i otomatik düzeltemedim — elle bakılmalı.`);
      }

      // Kullanıcı talebi: bulunan sorunu TÜM havuzda ara. Sadece somut,
      // formül/yöntem düzeyinde bir hata sınıfını işaret eden kategorilerde
      // (hesap-hatasi, tani-notu-uyumsuz) anlamlı — yazım/ölçme-değerlendirme
      // gibi soruya özgü sorunlarda kazanım-geneli tarama gereksiz token
      // harcar.
      if (finding.category === "hesap-hatasi" || finding.category === "tani-notu-uyumsuz") {
        const sweep = await sweepKazanim(row.kazanimId, row.id, created.id, ctxMap);
        totalTokens += sweep.tokensUsed;
        issuesFound += sweep.found;
      }
    }
  }

  await prisma.xrayQaReviewedRound.upsert({
    where: { testId: round.testId },
    create: { testId: round.testId, subject: round.subject, variant: round.variant, unitId: round.unitId, roundNumber: round.roundNumber, questionCount: questions.length, issuesFound, tokensUsed: totalTokens },
    update: { issuesFound, tokensUsed: totalTokens, reviewedAt: new Date() },
  });
  await logActivity("info", issuesFound === 0 ? `✔️ ${round.unitId} tur ${round.roundNumber} tamamen temiz çıktı, sorun bulamadım. Sıradaki tura geçiyorum.` : `✅ ${round.unitId} tur ${round.roundNumber} bitti — ${issuesFound} sorun buldum, hepsini ele aldım. Sıradaki tura geçiyorum.`);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await logActivity("info", `▶ QA denetimine başlıyorum — tüm soru havuzunu tur tur bağımsız bir gözle yeniden kontrol edeceğim.`);
  const ctxMap = subtopicContextMap();

  for (;;) {
    if (!(await checkGate())) {
      await logActivity("info", `⏸️ Durduruldum, paneldeki "Başlat" düğmesine basılınca kaldığım yerden devam edeceğim.`);
      return;
    }

    const reviewedTestIds = new Set((await prisma.xrayQaReviewedRound.findMany({ select: { testId: true } })).map((r) => r.testId));
    const pendingRounds = await prisma.xrayPoolGenerationRound.findMany({
      where: { subject: SUBJECT, status: "success", testId: { not: null } },
      orderBy: [{ unitId: "asc" }, { roundNumber: "asc" }],
    });
    const todo = pendingRounds.filter((r) => r.testId && !reviewedTestIds.has(r.testId));

    if (todo.length === 0) {
      await logActivity("info", `💤 Tüm havuzu taradım, şu an denetlenecek yeni tur yok. ${IDLE_POLL_MS / 60000} dakika sonra tekrar bakacağım.`);
      await sleep(IDLE_POLL_MS);
      continue;
    }

    await logActivity("info", `ℹ️ Sırada ${todo.length} tur var (toplam ${pendingRounds.length} başarılı turdan ${reviewedTestIds.size}'ini zaten taradım). Baştan sona geziyorum.`);
    for (const round of todo) {
      if (!(await checkGate())) {
        await logActivity("info", `⏸️ Durduruldum, paneldeki "Başlat" düğmesine basılınca kaldığım yerden devam edeceğim.`);
        return;
      }
      await reviewRound({ testId: round.testId!, subject: round.subject, variant: round.variant, unitId: round.unitId, roundNumber: round.roundNumber }, ctxMap);
    }
  }
}

main()
  .catch((err) => {
    console.error("QA denetim worker'ı hata ile durdu:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
