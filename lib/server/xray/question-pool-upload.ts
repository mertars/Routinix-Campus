import { z } from "zod";

// Faz W — yöneticinin "soru havuzu yükle" panelinden (bkz.
// components/xray/xray-question-pool-upload.tsx) gönderdiği JSON'un TEK
// doğrulama noktası. Şema, kullanıcının konu/test_adi/sorular[soruNo/
// kazanimId/questionText/finalAnswer/detailedSolution/diagnosticComment]
// formatıyla BİREBİR eşleşir (bkz. prisma/seed-xray-practice-test.ts'teki
// AYNI format, oradaki manuel tek-seferlik script'in yerini bu genel
// panel alıyor).
export const questionSchema = z.object({
  soruNo: z.number().int().positive(),
  kazanimId: z.string().trim().min(1, "kazanimId boş olamaz."),
  questionText: z.string().trim().min(1, "questionText boş olamaz."),
  finalAnswer: z.string().trim().min(1, "finalAnswer boş olamaz."),
  detailedSolution: z.string().trim().min(1, "detailedSolution boş olamaz."),
  diagnosticComment: z.string().trim().min(1, "diagnosticComment boş olamaz."),
});

export const incomingTestSchema = z.object({
  konu: z.string().trim().min(1, "konu boş olamaz."),
  test_adi: z.string().trim().min(1, "test_adi boş olamaz."),
  sorular: z.array(questionSchema).min(1, "sorular boş olamaz.").max(200, "Tek yüklemede en fazla 200 soru olabilir."),
});

export type IncomingTest = z.infer<typeof incomingTestSchema>;

// prisma/seed-xray-practice-test.ts'teki AYNI slugify — testId üretimi
// (bkz. o dosyadaki yorum) TEK doğru kaynak burada, iki yerde ayrı ayrı
// bakımı gerekmesin diye.
export function slugifyTestName(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
