// Faz C — arka plan QA denetim worker'ının (scripts/xray-qa-review.ts)
// prompt'ları. Bu, generation-time verify-content.ts'den (SYSTEM_PROMPT_VERIFY)
// BİLEREK AYRI ve DAHA TİTİZ bir ikinci geçiş: kullanıcı talebi "en az senin
// incelediğin kadar detaylı" olması — yani sadece cevap/çözüm tutarlılığı
// değil, yazım, müfredat uygunluğu, ölçme-değerlendirme kalitesi VE
// diagnosticComment'in (checks) soruya özgü/gerçek olup olmadığı da
// kontrol edilir. Bu son madde, bu oturumda elle bulunan Bulgu #2/#3'ün
// (572 satırlık toplu şablon-kopyalama hatası) bir daha fark edilmeden
// kalmaması için özellikle eklendi.
import { callChatCompletion, extractJson } from "./ai-client";

export type QaReviewCategory = "hesap-hatasi" | "yazim" | "mufredat" | "olcme-degerlendirme" | "tani-notu-uyumsuz" | "diger";
export type QaReviewSeverity = "kritik" | "orta" | "dusuk";

export type QaReviewQuestionInput = {
  soruNo: number;
  kazanimId: string;
  grade: number;
  topicName: string;
  subtopicName: string;
  questionText: string;
  finalAnswer: string;
  detailedSolution: string;
  diagnosticComment: string;
};

export type QaReviewFinding = {
  soruNo: number;
  category: QaReviewCategory;
  severity: QaReviewSeverity;
  summary: string;
};

export const SYSTEM_PROMPT_QA_REVIEW = `SEN ÇOK TİTİZ, ŞÜPHECİ VE BAĞIMSIZ ÇALIŞAN BİR LİSE MATEMATİK BAŞ EDİTÖRÜSÜN. Görevin, DAHA ÖNCE üretilip yayına alınmış (ve bir kez zaten otomatik denetimden geçmiş) soruları İKİNCİ, DAHA TİTİZ bir gözle yeniden denetlemek. Amacın hata BULMAK — "muhtemelen doğrudur" diye rahatlama, her soruyu suçlu ispatlanana kadar masum sayma.

Her soru için SIRAYLA şunları kontrol et:

1. HESAP DOĞRULUĞU: questionText'i finalAnswer/detailedSolution'a HİÇ bakmadan SIFIRDAN kendin çöz (ownAnswer). Sonra kendi cevabınla verilenAnswer'ı karşılaştır. Uyuşmuyorsa "hesap-hatasi" ile işaretle. Özellikle şu konularda GEÇMİŞTE sık hata yapıldı, bunlara EKSTRA dikkat et: kosinüs teoremi (b²+c²−a², 2bc çarpımı), permütasyon/kombinasyon/faktöriyel (ardışık çarpım/bölme adımları), koşullu olasılık ve Bayes teoremi (P(A|B)=P(A∩B)/P(B) payda/pay karışıklığı, P(B) tutarlılığı), basamak/EBOB-EKOK ile sayı bulma (tüm adayları taramadan eksik saymak, baştaki basamak≠0 kısıtını unutmak), kesir sadeleştirme (aslında sadeleşmeyen bir kesri sadeleşmiş göstermek), finalAnswer'ın detailedSolution'ın son satırıyla BİREBİR uyuşmaması.
2. YAZIM VE İFADE: Türkçe yazım/imla/noktalama hatası var mı? Soru cümlesi belirsiz/çift anlamlı mı? Eksik bilgi veya çözülemez bir durum var mı? Varsa "yazim" ile işaretle.
3. MÜFREDAT UYGUNLUĞU: Soru, verilen sınıf seviyesi + konu + alt konunun MEB müfredatının KAPSADIĞI çerçevede mi? Daha ileri bir sınıfın/üniversite düzeyinin yöntemini/formülünü kullanıyorsa "mufredat" ile işaretle.
4. ÖLÇME-DEĞERLENDİRME KALİTESİ: Soru öğrencinin gerçek anlayışını mı ölçüyor, yoksa kötü kurgulanmış mı (belirsiz ifade, birden fazla doğru cevaba açık, önemsiz/anlamsız bir şey soruyor, zorluk seviyesi soruNo aralığıyla tutarsız)? Sorunluysa "olcme-degerlendirme" ile işaretle.
5. TANI NOTU (diagnosticComment) TUTARLILIĞI: diagnosticComment, "Öğrenci bu soruda zorlandıysa: [Kazanım Adı] konusundaki [Eksik Kural/İşlem] eksiktir." formatında VE bu SPESİFİK sorunun İÇERİĞİNE/yöntemine GERÇEKTEN uygun olmalı. ŞÜPHELEN: bu not başka bir soru için yazılmış GENEL/kopyalanmış bir şablon gibi mi duruyor (örn. soru "üslü sayılarda aynı tabanlı ÇARPIM" işlemini soruyor ama not "ÜSSÜN ÜSSÜ" kuralından bahsediyor gibi bir YÖNTEM UYUMSUZLUĞU var mı)? Ya da meta-açıklama/doğrulama cümlesi mi (örn. "önceki soru hatalıydı, düzeltildi" veya "çözüm doğrudur") — bu İKİSİ DE öğrenciye anlamsızdır. Sorunluysa "tani-notu-uyumsuz" ile işaretle.

Emin olmadığın durumlarda sorunlu işaretlemeyi TERCİH ET (temkinli ol) — ama gerçek bir kanıt/muhakeme olmadan da rastgele işaretleme, her "sorunlu" için failure_scenario niteliğinde somut bir gerekçe yazabilmelisin.

severity: "kritik" (yanlış cevap/çözüm — öğrenciyi doğrudan yanıltır), "orta" (belirsizlik/müfredat/tanı notu uyumsuzluğu — kafa karıştırır ama yanlış öğretmez), "dusuk" (yazım/küçük ifade sorunu).

ÇIKTI FORMATI: SADECE geçerli bir JSON dizisi döndür, verilen soru sayısı kadar eleman, her biri:
{"soruNo": <sayı>, "ownAnswer": "<bağımsız ulaştığın cevap, kısa>", "verdict": "temiz" veya "sorunlu", "category": "hesap-hatasi"|"yazim"|"mufredat"|"olcme-degerlendirme"|"tani-notu-uyumsuz"|"diger" (verdict=temiz ise boş string ""), "severity": "kritik"|"orta"|"dusuk" (verdict=temiz ise boş string ""), "summary": "<verdict=sorunlu ise TEK-İKİ cümlelik somut gerekçe, temizse boş string \"\">"}
Başka hiçbir açıklama ekleme, çözümü tekrar yazma.`;

export function buildQaReviewUserPrompt(questions: QaReviewQuestionInput[]): string {
  const block = questions
    .map(
      (q) =>
        `soruNo ${q.soruNo} (kazanımId: ${q.kazanimId}, ${q.grade}. Sınıf > ${q.topicName} > ${q.subtopicName}):
questionText: ${q.questionText}
(referans — önce kendi çözümünü yap, sonra karşılaştır) verilenAnswer: ${q.finalAnswer}
verilenSolution: ${q.detailedSolution}
verilenDiagnosticComment: ${q.diagnosticComment}`,
    )
    .join("\n\n");
  return `Aşağıdaki ${questions.length} soruyu, sistem talimatındaki 5 kontrol adımını SIRAYLA uygulayarak denetle:\n\n${block}\n\nSadece JSON dizisini döndür.`;
}

export function parseQaReviewResponse(raw: string, expectedSoruNos: number[]): { ok: true; findings: QaReviewFinding[] } | { ok: false; errorSummary: string } {
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return { ok: false, errorSummary: "QA denetim yanıtı geçerli JSON değil." };
  }
  if (!Array.isArray(parsed)) return { ok: false, errorSummary: "QA denetim yanıtı bir JSON dizisi değil." };

  const rows = parsed as { soruNo?: number; verdict?: string; category?: string; severity?: string; summary?: string }[];
  const findings: QaReviewFinding[] = [];
  const validCategories = new Set<QaReviewCategory>(["hesap-hatasi", "yazim", "mufredat", "olcme-degerlendirme", "tani-notu-uyumsuz", "diger"]);
  const validSeverities = new Set<QaReviewSeverity>(["kritik", "orta", "dusuk"]);
  for (const r of rows) {
    if (r.verdict !== "sorunlu") continue;
    if (!Number.isInteger(r.soruNo) || !expectedSoruNos.includes(r.soruNo!)) continue;
    const category = validCategories.has(r.category as QaReviewCategory) ? (r.category as QaReviewCategory) : "diger";
    const severity = validSeverities.has(r.severity as QaReviewSeverity) ? (r.severity as QaReviewSeverity) : "orta";
    findings.push({ soruNo: r.soruNo!, category, severity, summary: r.summary?.trim() || "Belirtilmemiş sorun." });
  }
  return { ok: true, findings };
}

export async function runQaReview(model: string, maxTokens: number, questions: QaReviewQuestionInput[]): Promise<{ ok: true; findings: QaReviewFinding[]; tokensUsed: number } | { ok: false; errorSummary: string; tokensUsed: number }> {
  try {
    // Faz C — bu tek geçişlik, kapsamlı bir denetim olduğu için (üretim
    // hızından çok doğruluk önemli) "thinking" modu AÇIK bırakılır (bkz.
    // ai-client.ts enableThinking yorumu) — modelin adım adım kendini
    // doğrulama değerini burada gerçekten kullanmak istiyoruz.
    const completion = await callChatCompletion({ model, systemPrompt: SYSTEM_PROMPT_QA_REVIEW, userPrompt: buildQaReviewUserPrompt(questions), maxTokens, temperature: 0.1, enableThinking: true });
    const parsed = parseQaReviewResponse(completion.content, questions.map((q) => q.soruNo));
    if (!parsed.ok) return { ok: false, errorSummary: parsed.errorSummary, tokensUsed: completion.totalTokens };
    return { ok: true, findings: parsed.findings, tokensUsed: completion.totalTokens };
  } catch (error) {
    return { ok: false, errorSummary: error instanceof Error ? error.message : String(error), tokensUsed: 0 };
  }
}
