// Faz C — kullanıcı talebi: dış AI API'sinin (QwenCloud/DeepSeek) haftalık
// kota/kredisi soru ÜRETİMİ ile paylaşıldığı için, İKİNCİ (denetim) geçişte
// AYRICA tüketilmesin — "senin yapman lazım" (Claude Code'un kendisi, ayrı
// bir API çağrısı OLMADAN). Bu script scripts/xray-qa-review.ts'in YERİNE
// geçer: dış AI çağrısı YAPMAZ, sadece Claude'un (bu oturumda elle yaptığı
// incelemenin) sonucunu XrayQaFinding/XrayQaReviewedRound/XrayQaActivityLog
// tablolarına yazar — panel (aynı /platform QA Denetim Paneli) böylece AYNI
// şekilde çalışmaya devam eder, tek fark "kim inceledi" (tokensUsed=0 —
// dış API tüketimi YOK).
//
// Kullanım:
//   npx tsx --env-file=.env.local scripts/xray-qa-manual.ts next
//     → Sıradaki denetlenmemiş turun TÜM sorularını (SORU/CEVAP/ÇÖZÜM/TANI)
//       okunabilir metin olarak basar (Claude bunu okuyup elle inceler).
//   npx tsx --env-file=.env.local scripts/xray-qa-manual.ts submit <dosya.json>
//     → Aşağıdaki şemadaki bir JSON dosyasını okuyup DB'ye işler:
//       { "testId": "...", "findings": [{ "soruNo": 12, "category": "...",
//         "severity": "...", "summary": "...",
//         "fix": { "prompt": "...", "correctAnswer": "...", "solution": "...", "checks": "..." } }] }
//       fix alanı YOKSA bulgu "open" (elle bakılmalı) olarak kaydedilir.
//       findings BOŞ DİZİ ise tur "temiz" (0 bulgu) olarak işaretlenir.
import { prisma } from "../lib/server/prisma";
import { flattenCurriculum } from "../lib/server/xray/question-generation/curriculum-flatten";
import { readFileSync } from "fs";

const SUBJECT = "Matematik";

function subtopicContextMap() {
  const rows = flattenCurriculum(SUBJECT);
  return new Map(rows.map((s) => [s.subtopicId, { grade: s.grade, topicName: s.topicName, subtopicName: s.subtopicName }]));
}

async function logActivity(level: "info" | "found" | "fixed" | "manual" | "error", message: string) {
  console.log(message);
  await prisma.xrayQaActivityLog.create({ data: { subject: SUBJECT, level, message } }).catch(() => {});
}

async function cmdNext() {
  const reviewedTestIds = new Set((await prisma.xrayQaReviewedRound.findMany({ select: { testId: true } })).map((r) => r.testId));
  const pendingRounds = await prisma.xrayPoolGenerationRound.findMany({
    where: { subject: SUBJECT, status: "success", testId: { not: null } },
    orderBy: [{ unitId: "asc" }, { roundNumber: "asc" }],
  });
  const todo = pendingRounds.filter((r) => r.testId && !reviewedTestIds.has(r.testId));
  console.log(`(${todo.length} tur kaldı, toplam ${pendingRounds.length} başarılı turdan ${reviewedTestIds.size} tanesi zaten denetlendi)\n`);
  const round = todo[0];
  if (!round) {
    console.log("Denetlenecek yeni tur yok.");
    return;
  }

  const questions = await prisma.xrayPracticeQuestion.findMany({
    where: { testId: round.testId! },
    select: { id: true, order: true, kazanimId: true, prompt: true, correctAnswer: true, solution: true, checks: true, subtopicId: true },
    orderBy: { order: "asc" },
  });
  const ctxMap = subtopicContextMap();
  const ctx = questions[0] ? ctxMap.get(questions[0].subtopicId) : undefined;

  console.log(`=== testId=${round.testId} — ${round.unitId} tur ${round.roundNumber} — ${questions.length} soru — ${ctx ? `${ctx.grade}.Sınıf ${ctx.topicName}` : ""} ===\n`);
  for (const q of questions) {
    console.log(`--- soruNo ${q.order} (kazanımId: ${q.kazanimId}, id=${q.id}) ---`);
    console.log(`SORU: ${q.prompt}`);
    console.log(`CEVAP: ${q.correctAnswer}`);
    console.log(`ÇÖZÜM: ${q.solution}`);
    console.log(`TANI: ${q.checks}`);
    console.log();
  }
}

type SubmitFinding = {
  soruNo: number;
  category: string;
  severity: string;
  summary: string;
  fix?: { prompt: string; correctAnswer: string; solution: string; checks: string };
};
type SubmitPayload = { testId: string; findings: SubmitFinding[] };

async function cmdSubmit(filePath: string) {
  const payload = JSON.parse(readFileSync(filePath, "utf-8")) as SubmitPayload;
  const round = await prisma.xrayPoolGenerationRound.findFirst({ where: { subject: SUBJECT, testId: payload.testId, status: "success" } });
  if (!round) throw new Error(`testId=${payload.testId} için başarılı bir tur bulunamadı.`);

  const questions = await prisma.xrayPracticeQuestion.findMany({ where: { testId: payload.testId } });
  const byOrder = new Map(questions.map((q) => [q.order, q]));

  if (payload.findings.length === 0) {
    await logActivity("info", `✔️ ${round.unitId} tur ${round.roundNumber} tamamen temiz çıktı, sorun bulamadım.`);
  }

  for (const f of payload.findings) {
    const row = byOrder.get(f.soruNo);
    if (!row) {
      console.error(`⚠️ soruNo ${f.soruNo} bulunamadı, atlanıyor.`);
      continue;
    }
    await logActivity("found", `🚩 ${round.unitId} tur ${round.roundNumber}, soru ${f.soruNo}'de sorun buldum [${f.category}]: ${f.summary}`);

    const created = await prisma.xrayQaFinding.create({
      data: {
        questionId: row.id,
        testId: payload.testId,
        subject: SUBJECT,
        unitId: round.unitId,
        soruNo: f.soruNo,
        kazanimId: row.kazanimId,
        category: f.category,
        severity: f.severity,
        summary: f.summary,
        beforePrompt: row.prompt,
        beforeCorrectAnswer: row.correctAnswer,
        beforeSolution: row.solution,
        beforeChecks: row.checks,
      },
    });

    if (f.fix) {
      await prisma.xrayPracticeQuestion.update({ where: { id: row.id }, data: { prompt: f.fix.prompt, correctAnswer: f.fix.correctAnswer, solution: f.fix.solution, checks: f.fix.checks } });
      await prisma.xrayQaFinding.update({ where: { id: created.id }, data: { status: "fixed", fixedAt: new Date(), afterPrompt: f.fix.prompt, afterCorrectAnswer: f.fix.correctAnswer, afterSolution: f.fix.solution, afterChecks: f.fix.checks } });
      await logActivity("fixed", `✅ Düzelttim — soru ${f.soruNo} artık doğru.`);
    } else {
      await logActivity("manual", `❌ Soru ${f.soruNo} için elle karar bekliyor.`);
    }
  }

  await prisma.xrayQaReviewedRound.upsert({
    where: { testId: payload.testId },
    create: { testId: payload.testId, subject: SUBJECT, variant: round.variant, unitId: round.unitId, roundNumber: round.roundNumber, questionCount: questions.length, issuesFound: payload.findings.length, tokensUsed: 0 },
    update: { issuesFound: payload.findings.length, tokensUsed: 0, reviewedAt: new Date() },
  });
  await logActivity("info", payload.findings.length === 0 ? `✅ ${round.unitId} tur ${round.roundNumber} bitti — temiz.` : `✅ ${round.unitId} tur ${round.roundNumber} bitti — ${payload.findings.length} sorun buldum, hepsini ele aldım.`);
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "next") await cmdNext();
  else if (cmd === "submit" && arg) await cmdSubmit(arg);
  else {
    console.error("Kullanım: xray-qa-manual.ts next | xray-qa-manual.ts submit <dosya.json>");
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("Hata:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
