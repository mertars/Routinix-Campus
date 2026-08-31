import { extractJson } from "./ai-client";
import { validateQuestions } from "@/lib/xray-question-import/validate";
import type { RawQuestion } from "@/lib/xray-question-import/types";

export type RoundValidationResult = { ok: true; questions: RawQuestion[]; blueprint: string[] } | { ok: false; errorSummary: string };

// round 1 için lockedBlueprint=null (blueprint bu turda kilitlenir); round
// 2+ için lockedBlueprint zorunlu — dönen kazanımId dizisi BİREBİR bu
// diziyle eşleşmezse geçersiz sayılır (bkz. lib/server/xray/practice-pool.ts
// occurrence eşleştirmesinin turlar arası tutarlı kazanım YAPISINA bağımlı
// olması).
export function validateRoundResponse(rawContent: string, lockedBlueprint: string[] | null): RoundValidationResult {
  let parsed: unknown;
  try {
    parsed = extractJson(rawContent);
  } catch {
    return { ok: false, errorSummary: "Yanıt geçerli JSON değil." };
  }

  if (!Array.isArray(parsed)) return { ok: false, errorSummary: "Yanıt bir JSON dizisi olmalı." };
  if (parsed.length !== 30) return { ok: false, errorSummary: `Tam 30 soru bekleniyordu, ${parsed.length} geldi.` };

  const questions = parsed as RawQuestion[];
  const validated = validateQuestions(questions);
  const invalid = validated.filter((v) => !v.isValid);
  if (invalid.length > 0) {
    const summary = invalid
      .slice(0, 5)
      .map((v) => `${v.label}: ${v.errors.join(", ")}`)
      .join(" | ");
    return { ok: false, errorSummary: `${invalid.length} soru geçersiz alan içeriyor: ${summary}` };
  }

  const bySoruNo = [...questions].sort((a, b) => (a.soruNo ?? 0) - (b.soruNo ?? 0));
  const soruNos = bySoruNo.map((q) => q.soruNo);
  const expectedSoruNos = Array.from({ length: 30 }, (_, i) => i + 1);
  if (JSON.stringify(soruNos) !== JSON.stringify(expectedSoruNos)) {
    return { ok: false, errorSummary: "soruNo değerleri 1-30 arasını eksiksiz/tekrarsız kapsamıyor." };
  }

  const questionTexts = new Set(bySoruNo.map((q) => q.questionText?.trim()));
  if (questionTexts.size !== 30) return { ok: false, errorSummary: "Aynı questionText birden fazla kez tekrar ediyor (kopyala-yapıştır şüphesi)." };

  const kazanimSequence = bySoruNo.map((q) => q.kazanimId!.trim());

  if (lockedBlueprint) {
    const mismatches: string[] = [];
    for (let i = 0; i < 30; i++) {
      if (kazanimSequence[i] !== lockedBlueprint[i]) mismatches.push(`soruNo ${i + 1}: beklenen "${lockedBlueprint[i]}", gelen "${kazanimSequence[i]}"`);
    }
    if (mismatches.length > 0) {
      return { ok: false, errorSummary: `kazanimId dizisi blueprint'le uyuşmuyor (${mismatches.length} pozisyon): ${mismatches.slice(0, 5).join(" | ")}` };
    }
  }

  return { ok: true, questions: bySoruNo, blueprint: lockedBlueprint ?? kazanimSequence };
}
