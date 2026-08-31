import { extractJson } from "./ai-client";
import type { FlattenedTopic } from "./curriculum-flatten";

export type GenelRawQuestion = {
  soruNo?: number;
  subtopicAdi?: string;
  kazanimId?: string;
  questionText?: string;
  finalAnswer?: string;
  detailedSolution?: string;
  diagnosticComment?: string;
};

export type GenelBlueprintSlot = { subtopicId: string; kazanimId: string };
export type GenelValidatedQuestion = { soruNo: number; subtopicId: string; kazanimId: string; questionText: string; finalAnswer: string; detailedSolution: string; diagnosticComment: string };
export type RoundValidationResult = { ok: true; questions: GenelValidatedQuestion[]; blueprint: GenelBlueprintSlot[] } | { ok: false; errorSummary: string };

// "genel" variant için doğrulama — round 1 için lockedBlueprint=null (bu
// turda kilitlenir); round 2+ için lockedBlueprint zorunlu, dönen
// (subtopicId, kazanımId) dizisi BİREBİR bu diziyle eşleşmezse geçersiz
// sayılır (bkz. lib/server/xray/practice-pool.ts occurrence eşleştirmesinin
// turlar arası tutarlı kazanım YAPISINA bağımlı olması).
export function validateGenelRoundResponse(rawContent: string, topic: FlattenedTopic, lockedBlueprint: GenelBlueprintSlot[] | null): RoundValidationResult {
  let parsed: unknown;
  try {
    parsed = extractJson(rawContent);
  } catch {
    return { ok: false, errorSummary: "Yanıt geçerli JSON değil." };
  }

  if (!Array.isArray(parsed)) return { ok: false, errorSummary: "Yanıt bir JSON dizisi olmalı." };
  if (parsed.length !== 30) return { ok: false, errorSummary: `Tam 30 soru bekleniyordu, ${parsed.length} geldi.` };

  const questions = parsed as GenelRawQuestion[];
  const nameToId = new Map(topic.subtopics.map((s) => [s.subtopicName, s.subtopicId]));

  const fieldErrors: string[] = [];
  for (const [i, q] of questions.entries()) {
    if (!Number.isInteger(q.soruNo) || q.soruNo! <= 0) fieldErrors.push(`#${i + 1}: soruNo geçersiz`);
    if (!q.subtopicAdi || !nameToId.has(q.subtopicAdi)) fieldErrors.push(`#${i + 1}: subtopicAdi="${q.subtopicAdi}" listede yok`);
    if (!q.kazanimId?.trim()) fieldErrors.push(`#${i + 1}: kazanimId boş`);
    if (!q.questionText?.trim()) fieldErrors.push(`#${i + 1}: questionText boş`);
    if (!q.finalAnswer?.trim()) fieldErrors.push(`#${i + 1}: finalAnswer boş`);
    if (!q.detailedSolution?.trim()) fieldErrors.push(`#${i + 1}: detailedSolution boş`);
    if (!q.diagnosticComment?.trim()) fieldErrors.push(`#${i + 1}: diagnosticComment boş`);
  }
  if (fieldErrors.length > 0) return { ok: false, errorSummary: `${fieldErrors.length} alan hatası: ${fieldErrors.slice(0, 5).join(" | ")}` };

  const bySoruNo = [...questions].sort((a, b) => a.soruNo! - b.soruNo!);
  const soruNos = bySoruNo.map((q) => q.soruNo);
  const expected = Array.from({ length: 30 }, (_, i) => i + 1);
  if (JSON.stringify(soruNos) !== JSON.stringify(expected)) return { ok: false, errorSummary: "soruNo değerleri 1-30 arasını eksiksiz/tekrarsız kapsamıyor." };

  const texts = new Set(bySoruNo.map((q) => q.questionText!.trim()));
  if (texts.size !== 30) return { ok: false, errorSummary: "Aynı questionText birden fazla kez tekrar ediyor (kopyala-yapıştır şüphesi)." };

  const usedSubtopicIds = new Set(bySoruNo.map((q) => nameToId.get(q.subtopicAdi!)!));
  const missingSubtopics = topic.subtopics.filter((s) => !usedSubtopicIds.has(s.subtopicId));
  if (missingSubtopics.length > 0) return { ok: false, errorSummary: `Şu alt konulardan HİÇ soru yok: ${missingSubtopics.map((s) => s.subtopicName).join(", ")}` };

  const resultSequence: GenelBlueprintSlot[] = bySoruNo.map((q) => ({ subtopicId: nameToId.get(q.subtopicAdi!)!, kazanimId: q.kazanimId!.trim() }));

  if (lockedBlueprint) {
    const mismatches: string[] = [];
    for (let i = 0; i < 30; i++) {
      if (resultSequence[i].subtopicId !== lockedBlueprint[i].subtopicId || resultSequence[i].kazanimId !== lockedBlueprint[i].kazanimId) {
        mismatches.push(`soruNo ${i + 1}: beklenen (${lockedBlueprint[i].subtopicId}, ${lockedBlueprint[i].kazanimId}), gelen (${resultSequence[i].subtopicId}, ${resultSequence[i].kazanimId})`);
      }
    }
    if (mismatches.length > 0) return { ok: false, errorSummary: `blueprint uyuşmuyor (${mismatches.length} pozisyon): ${mismatches.slice(0, 5).join(" | ")}` };
  }

  const validatedQuestions: GenelValidatedQuestion[] = bySoruNo.map((q, i) => ({
    soruNo: q.soruNo!,
    subtopicId: resultSequence[i].subtopicId,
    kazanimId: resultSequence[i].kazanimId,
    questionText: q.questionText!.trim(),
    finalAnswer: q.finalAnswer!.trim(),
    detailedSolution: q.detailedSolution!.trim(),
    diagnosticComment: q.diagnosticComment!.trim(),
  }));

  return { ok: true, questions: validatedQuestions, blueprint: lockedBlueprint ?? resultSequence };
}

export type AltKonuRawQuestion = { soruNo?: number; kazanimId?: string; questionText?: string; finalAnswer?: string; detailedSolution?: string; diagnosticComment?: string };
export type AltKonuValidatedQuestion = { soruNo: number; kazanimId: string; questionText: string; finalAnswer: string; detailedSolution: string; diagnosticComment: string };
export type AltKonuValidationResult = { ok: true; questions: AltKonuValidatedQuestion[]; blueprint: string[] } | { ok: false; errorSummary: string };

// "alt_konu" variant için doğrulama — 10 soru, TEK bir alt konu. round 1
// için lockedBlueprint=null (bu turda kilitlenir); round 2+ için dönen
// kazanımId dizisi BİREBİR lockedBlueprint'le eşleşmezse geçersiz sayılır.
export function validateAltKonuRoundResponse(rawContent: string, lockedBlueprint: string[] | null): AltKonuValidationResult {
  let parsed: unknown;
  try {
    parsed = extractJson(rawContent);
  } catch {
    return { ok: false, errorSummary: "Yanıt geçerli JSON değil." };
  }

  if (!Array.isArray(parsed)) return { ok: false, errorSummary: "Yanıt bir JSON dizisi olmalı." };
  if (parsed.length !== 10) return { ok: false, errorSummary: `Tam 10 soru bekleniyordu, ${parsed.length} geldi.` };

  const questions = parsed as AltKonuRawQuestion[];
  const fieldErrors: string[] = [];
  for (const [i, q] of questions.entries()) {
    if (!Number.isInteger(q.soruNo) || q.soruNo! <= 0) fieldErrors.push(`#${i + 1}: soruNo geçersiz`);
    if (!q.kazanimId?.trim()) fieldErrors.push(`#${i + 1}: kazanimId boş`);
    if (!q.questionText?.trim()) fieldErrors.push(`#${i + 1}: questionText boş`);
    if (!q.finalAnswer?.trim()) fieldErrors.push(`#${i + 1}: finalAnswer boş`);
    if (!q.detailedSolution?.trim()) fieldErrors.push(`#${i + 1}: detailedSolution boş`);
    if (!q.diagnosticComment?.trim()) fieldErrors.push(`#${i + 1}: diagnosticComment boş`);
  }
  if (fieldErrors.length > 0) return { ok: false, errorSummary: `${fieldErrors.length} alan hatası: ${fieldErrors.slice(0, 5).join(" | ")}` };

  const bySoruNo = [...questions].sort((a, b) => a.soruNo! - b.soruNo!);
  const soruNos = bySoruNo.map((q) => q.soruNo);
  const expected = Array.from({ length: 10 }, (_, i) => i + 1);
  if (JSON.stringify(soruNos) !== JSON.stringify(expected)) return { ok: false, errorSummary: "soruNo değerleri 1-10 arasını eksiksiz/tekrarsız kapsamıyor." };

  const texts = new Set(bySoruNo.map((q) => q.questionText!.trim()));
  if (texts.size !== 10) return { ok: false, errorSummary: "Aynı questionText birden fazla kez tekrar ediyor (kopyala-yapıştır şüphesi)." };

  const kazanimSequence = bySoruNo.map((q) => q.kazanimId!.trim());

  if (lockedBlueprint) {
    const mismatches: string[] = [];
    for (let i = 0; i < 10; i++) {
      if (kazanimSequence[i] !== lockedBlueprint[i]) mismatches.push(`soruNo ${i + 1}: beklenen "${lockedBlueprint[i]}", gelen "${kazanimSequence[i]}"`);
    }
    if (mismatches.length > 0) return { ok: false, errorSummary: `kazanimId dizisi blueprint'le uyuşmuyor (${mismatches.length} pozisyon): ${mismatches.slice(0, 5).join(" | ")}` };
  }

  const validatedQuestions: AltKonuValidatedQuestion[] = bySoruNo.map((q, i) => ({
    soruNo: q.soruNo!,
    kazanimId: kazanimSequence[i],
    questionText: q.questionText!.trim(),
    finalAnswer: q.finalAnswer!.trim(),
    detailedSolution: q.detailedSolution!.trim(),
    diagnosticComment: q.diagnosticComment!.trim(),
  }));

  return { ok: true, questions: validatedQuestions, blueprint: lockedBlueprint ?? kazanimSequence };
}

export type FixedQuestion = { soruNo: number; questionText: string; finalAnswer: string; detailedSolution: string; diagnosticComment: string };
export type FixValidationResult = { ok: true; fixed: FixedQuestion[] } | { ok: false; errorSummary: string };

// Faz Z9 — hedefli düzeltme yanıtını doğrular: SADECE istenen soruNo'lar
// (ne eksik ne fazla) dönmüş mü, tüm alanlar dolu mu. kazanımId/subtopicId
// bilerek BURADA doğrulanmıyor — fix prompt'u zaten bunları modelin
// EMİTMEMESİNİ istiyor (worker script çağıran taraf zaten blueprint'ten
// biliyor, üzerine yazmaz).
export function validateFixResponse(rawContent: string, expectedSoruNos: number[]): FixValidationResult {
  let parsed: unknown;
  try {
    parsed = extractJson(rawContent);
  } catch {
    return { ok: false, errorSummary: "Düzeltme yanıtı geçerli JSON değil." };
  }
  if (!Array.isArray(parsed)) return { ok: false, errorSummary: "Düzeltme yanıtı bir JSON dizisi olmalı." };
  if (parsed.length !== expectedSoruNos.length) return { ok: false, errorSummary: `${expectedSoruNos.length} düzeltilmiş soru bekleniyordu, ${parsed.length} geldi.` };

  const rows = parsed as { soruNo?: number; questionText?: string; finalAnswer?: string; detailedSolution?: string; diagnosticComment?: string }[];
  const fieldErrors: string[] = [];
  for (const [i, q] of rows.entries()) {
    if (!Number.isInteger(q.soruNo)) fieldErrors.push(`#${i + 1}: soruNo geçersiz`);
    if (!q.questionText?.trim()) fieldErrors.push(`#${i + 1}: questionText boş`);
    if (!q.finalAnswer?.trim()) fieldErrors.push(`#${i + 1}: finalAnswer boş`);
    if (!q.detailedSolution?.trim()) fieldErrors.push(`#${i + 1}: detailedSolution boş`);
    if (!q.diagnosticComment?.trim()) fieldErrors.push(`#${i + 1}: diagnosticComment boş`);
  }
  if (fieldErrors.length > 0) return { ok: false, errorSummary: `${fieldErrors.length} alan hatası: ${fieldErrors.slice(0, 5).join(" | ")}` };

  const gotSoruNos = new Set(rows.map((r) => r.soruNo));
  const expectedSet = new Set(expectedSoruNos);
  const missing = expectedSoruNos.filter((n) => !gotSoruNos.has(n));
  const extra = [...gotSoruNos].filter((n) => !expectedSet.has(n as number));
  if (missing.length > 0 || extra.length > 0) return { ok: false, errorSummary: `soruNo uyuşmazlığı — eksik: [${missing.join(",")}], fazla: [${extra.join(",")}]` };

  const fixed: FixedQuestion[] = rows.map((q) => ({
    soruNo: q.soruNo!,
    questionText: q.questionText!.trim(),
    finalAnswer: q.finalAnswer!.trim(),
    detailedSolution: q.detailedSolution!.trim(),
    diagnosticComment: q.diagnosticComment!.trim(),
  }));
  return { ok: true, fixed };
}
