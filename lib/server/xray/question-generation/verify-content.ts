import { callChatCompletion, extractJson } from "./ai-client";

// Faz Z8/Z10 — kullanıcı talebi: her tur üretildikten SONRA, kabul
// edilmeden önce ikinci bir bağımsız geçişte gözden geçirilsin (cevap
// doğru mu, soru mantıklı mı, yazım hatası var mı). Bu, generateGenelRound/
// generateAltKonuRound'un İÇİNDE, yapısal doğrulamadan (validate-round.ts)
// SONRA ama DB'ye yazmadan ÖNCE çağrılır.
//
// Faz Z10 — "BAĞIMSIZ ÇÖZÜM ÖNCE" tekniği: önceki hâli modele "bu cevap
// doğru mu?" diye soruyordu — bu, modeli verilen (belki yanlış) cevaba
// ÇAPALAR (anchoring bias), sadece "mantıklı görünüyor mu" diye yüzeysel
// bakma riski taşır. Artık model ÖNCE finalAnswer/detailedSolution'a HİÇ
// bakmadan SADECE soruyu okuyup KENDİ çözümünü/cevabını üretiyor, SONRA
// kendi ürettiğiyle verileni karşılaştırıyor — kanıtlanmış bir teknik
// (self-consistency / bağımsız yeniden türetme), çapalama riskini ortadan
// kaldırır. Model çağıran taraftan (worker) FARKLI bir aile/model olabilir
// (bkz. VERIFY_MODEL sabiti) — üretimle AYNI modelin kendi kör noktalarını
// paylaşma riskini azaltır.
export const SYSTEM_PROMPT_VERIFY = `SEN ÇOK TİTİZ, BAĞIMSIZ ÇALIŞAN BİR LİSE MATEMATİK EDİTÖRÜSÜN. Sana bir soru listesi verilecek (soruNo, questionText, ve AYRICA — sadece referans için en sonda — verilenAnswer/verilenSolution).

YÖNTEM (ÇOK ÖNEMLİ, SIRAYLA UYGULA):
1. Her soru için ÖNCE SADECE questionText'i oku. verilenAnswer/verilenSolution'a HENÜZ BAKMA. Soruyu SIFIRDAN, kendi başına çöz ve kendi cevabına (ownAnswer) ulaş.
2. ANCAK BUNDAN SONRA verilenAnswer ile ownAnswer'ını karşılaştır. Eşleşmiyorsa "sorunlu" işaretle.
3. Ayrıca kontrol et: questionText açık/mantıklı/çözülebilir mi (eksik bilgi, imkansız durum yok mu)? Türkçe yazım/imla hatası var mı?

Emin olmadığın durumlarda "sorunlu" olarak işaretle (temkinli ol, hata kaçırmaktansa fazla işaretlemek daha iyidir).

ÇIKTI FORMATI: SADECE geçerli bir JSON dizisi döndür, verilen soru sayısı kadar eleman, her biri:
{"soruNo": <sayı>, "ownAnswer": "<senin bağımsız ulaştığın cevap, kısa>", "verdict": "gecerli" veya "sorunlu", "reason": "<sorunluysa TEK CÜMLE kısa gerekçe, geçerliyse boş string "">"}
Çözümü tekrar yazma, sadece ownAnswer + kısa karar ver. Başka hiçbir açıklama ekleme.`;

export function buildVerificationUserPrompt(questions: { soruNo: number; questionText: string; finalAnswer: string; detailedSolution: string }[]): string {
  const block = questions
    .map((q) => `soruNo ${q.soruNo}:\nquestionText: ${q.questionText}\n(referans — önce kendi çözümünü yap) verilenAnswer: ${q.finalAnswer}\nverilenSolution: ${q.detailedSolution}`)
    .join("\n\n");
  return `Aşağıdaki ${questions.length} soruyu, YÖNTEM adımlarını sırayla uygulayarak kontrol et:\n\n${block}\n\nSadece JSON dizisini döndür.`;
}

export type VerificationIssue = { soruNo: number; reason: string };
export type VerificationResult = { ok: true } | { ok: false; issues: VerificationIssue[] } | { ok: "check-failed"; errorSummary: string };

export async function verifyContent(
  model: string,
  maxTokens: number,
  questions: { soruNo: number; questionText: string; finalAnswer: string; detailedSolution: string }[],
): Promise<VerificationResult & { tokensUsed: number }> {
  try {
    // Faz Z10 — sıcaklık 0.1: doğrulama görevinde YARATICILIĞA hiç gerek
    // yok, sadece tutarlı/kararlı bir hesaplama ve karşılaştırma isteniyor.
    const completion = await callChatCompletion({ model, systemPrompt: SYSTEM_PROMPT_VERIFY, userPrompt: buildVerificationUserPrompt(questions), maxTokens, temperature: 0.1 });
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
