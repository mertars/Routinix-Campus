import type { RawQuestion, ValidatedQuestion } from "./types";

// Sunucudaki (app/api/xray/practice-questions/upload) doğrulamanın
// istemci tarafı AYNASI — lib/bulk-import/validate.ts'teki AYNI ilke:
// kullanıcıya göndermeden ÖNCE anında geri bildirim verir, ama nihai/
// yetkili doğrulama HER ZAMAN sunucudadır (bu fonksiyon ORADA DA
// olduğu gibi tekrar çağrılır — istemciye güvenilmez).
export function validateQuestions(rawQuestions: RawQuestion[]): ValidatedQuestion[] {
  const seenSoruNo = new Set<number>();

  return rawQuestions.map((raw, rowIndex) => {
    const errors: string[] = [];

    if (raw.soruNo === undefined || raw.soruNo === null || !Number.isInteger(raw.soruNo) || raw.soruNo <= 0) {
      errors.push("soruNo geçerli bir pozitif tam sayı olmalı.");
    } else if (seenSoruNo.has(raw.soruNo)) {
      errors.push("Bu soruNo dosya içinde tekrar ediyor.");
    } else {
      seenSoruNo.add(raw.soruNo);
    }

    if (!raw.kazanimId?.trim()) errors.push("kazanimId zorunludur.");
    if (!raw.questionText?.trim()) errors.push("questionText zorunludur.");
    if (!raw.finalAnswer?.trim()) errors.push("finalAnswer zorunludur.");
    if (!raw.detailedSolution?.trim()) errors.push("detailedSolution zorunludur.");
    if (!raw.diagnosticComment?.trim()) errors.push("diagnosticComment zorunludur.");

    const label = raw.questionText ? `Soru ${raw.soruNo ?? rowIndex + 1}: ${raw.questionText.slice(0, 70)}` : `Soru ${rowIndex + 1}`;

    return { rowIndex, raw, label, isValid: errors.length === 0, errors };
  });
}
