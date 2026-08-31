import { callChatCompletion, extractJson } from "./ai-client";

// Faz Z8 — kullanıcı talebi: her tur üretildikten SONRA, kabul edilmeden
// önce ikinci bir bağımsız geçişte gözden geçirilsin (cevap doğru mu, soru
// mantıklı mı, yazım hatası var mı). Bu, generateGenelRound/
// generateAltKonuRound'un İÇİNDE, yapısal doğrulamadan (validate-round.ts)
// SONRA ama DB'ye yazmadan ÖNCE çağrılır — "sorunlu" bulunan bir tur,
// yapısal doğrulama hatasıyla AYNI şekilde ele alınır: MAX_ATTEMPTS_PER_
// ROUND retry döngüsüne düzeltme talebiyle geri döner. Maliyet notu: bu
// turun TÜM sorularını tekrar modele okutup kompakt bir JSON karar listesi
// istediği için ek bir tam API çağrısı = üretimin kendisine yakın boyutta
// ekstra girdi token'ı (ama çıktı KÜÇÜK tutulur — sadece verdict+kısa
// gerekçe, çözümü tekrar yazdırmıyoruz).
export const SYSTEM_PROMPT_VERIFY = `SEN ÇOK TİTİZ BİR LİSE MATEMATİK ÖĞRETMENİ VE EDİTÖRSÜN. Sana bir soru listesi verilecek (soruNo, questionText, finalAnswer, detailedSolution). HER soru için BAĞIMSIZ OLARAK kendi hesabını yaparak şunları kontrol et:

1. finalAnswer, detailedSolution'daki çözümle TUTARLI mı ve matematiksel olarak GERÇEKTEN doğru mu (kendi hesabını yap, sadece görünüşe güvenme).
2. questionText açık, mantıklı ve çözülebilir mi (eksik bilgi, imkansız/çelişkili durum yok mu)?
3. Türkçe yazım/imla/noktalama hatası var mı?

Emin olmadığın durumlarda "sorunlu" olarak işaretle (temkinli ol, hata kaçırmaktansa fazla işaretlemek daha iyidir).

ÇIKTI FORMATI: SADECE geçerli bir JSON dizisi döndür, verilen soru sayısı kadar eleman, her biri:
{"soruNo": <sayı>, "verdict": "gecerli" veya "sorunlu", "reason": "<sorunluysa TEK CÜMLE kısa gerekçe, geçerliyse boş string "">"}
Çözümü/soruyu TEKRAR YAZMA, sadece kısa karar ver. Başka hiçbir açıklama ekleme.`;

export function buildVerificationUserPrompt(questions: { soruNo: number; questionText: string; finalAnswer: string; detailedSolution: string }[]): string {
  const block = questions.map((q) => `soruNo ${q.soruNo}:\nSoru: ${q.questionText}\nVerilen Cevap: ${q.finalAnswer}\nVerilen Çözüm: ${q.detailedSolution}`).join("\n\n");
  return `Aşağıdaki ${questions.length} soruyu kontrol et:\n\n${block}\n\nSadece JSON dizisini döndür.`;
}

export type VerificationIssue = { soruNo: number; reason: string };
export type VerificationResult = { ok: true } | { ok: false; issues: VerificationIssue[] } | { ok: "check-failed"; errorSummary: string };

export async function verifyContent(
  model: string,
  maxTokens: number,
  questions: { soruNo: number; questionText: string; finalAnswer: string; detailedSolution: string }[],
): Promise<VerificationResult & { tokensUsed: number }> {
  try {
    const completion = await callChatCompletion({ model, systemPrompt: SYSTEM_PROMPT_VERIFY, userPrompt: buildVerificationUserPrompt(questions), maxTokens });
    let parsed: unknown;
    try {
      parsed = extractJson(completion.content);
    } catch {
      return { ok: "check-failed", errorSummary: "Doğrulama yanıtı geçerli JSON değil.", tokensUsed: completion.totalTokens };
    }
    if (!Array.isArray(parsed)) return { ok: "check-failed", errorSummary: "Doğrulama yanıtı bir JSON dizisi değil.", tokensUsed: completion.totalTokens };

    const verdicts = parsed as { soruNo?: number; verdict?: string; reason?: string }[];
    const issues: VerificationIssue[] = [];
    for (const v of verdicts) {
      if (v.verdict === "sorunlu") issues.push({ soruNo: v.soruNo ?? -1, reason: v.reason?.trim() || "Belirtilmemiş sorun." });
    }
    if (issues.length > 0) return { ok: false, issues, tokensUsed: completion.totalTokens };
    return { ok: true, tokensUsed: completion.totalTokens };
  } catch (error) {
    return { ok: "check-failed", errorSummary: error instanceof Error ? error.message : String(error), tokensUsed: 0 };
  }
}
