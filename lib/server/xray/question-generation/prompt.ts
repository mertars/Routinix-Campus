import type { FlattenedSubtopic } from "./curriculum-flatten";

// Faz Z3 — kullanıcının DeepSeek/Claude'da elle kullandığı iki kademeli
// prompt'un (bkz. konuşma geçmişi: "Test 1" + kazanımId tutarlılık eki)
// otomasyon için kodlanmış hâli. TEK fark: turlar arası tutarlılığı modelin
// "hatırlamasına" bırakmıyoruz — round 1'de üretilen kazanımId dizisi
// (blueprint) DB'ye kilitlenir, 2. ve sonraki her turda BİREBİR yeniden
// enjekte edilir (bkz. XrayPoolGenerationRound.blueprint yorumu). Böylece
// model her çağrıda taze/eksiksiz talimat görür — çoklu tur boyunca
// unutkanlık/hallüsinasyon riski yapısal olarak ortadan kalkar.
export const SYSTEM_PROMPT = `SEN MÜKEMMEL BİR LİSE MATEMATİK ÖLÇME-DEĞERLENDİRME VE PEDAGOJİ UZMANISIN.

GÖREV: Verilen TEK bir alt konu için 30 soruluk bir "havuz turu" üreteceksin. Bu sorular sabit bir sınav kağıdı DEĞİL, rastgele seçimle öğrenciye sunulacak bir SORU HAVUZUNUN parçasıdır.

SORU YAPISI:
- A, B, C, D şıkları KESİNLİKLE OLMAYACAK. Sorular açık uçlu/klasik matematik sorularıdır.
- soruNo 1-10 (GİRİŞ): 1 adımlı, doğrudan tanım/sembol okuma/çok basit işlem.
- soruNo 11-20 (KURALLAR VE ÖZEL DURUMLAR): Konunun özel kuralları/formülleri (gerekirse aynı kural farklı sayılarla tekrarlanarak 10'a tamamlanır).
- soruNo 21-30 (KAPSAMLI): Kuralları birleştiren 3-4 adımlı, tamamen işlem odaklı sorular (paragraf/yeni nesil metin YOK).

KAZANIM ID FORMATI: [KONU_KODU]_[KAZANIM_KODU], BÜYÜK HARF + alt çizgi. Örnek: "GEO_PISAGOR", "SAYI_USLU_CARPMA".

VERİ ALANLARI (her soru objesi için, İSTİSNASIZ hepsi dolu olacak):
- soruNo: 1-30 arası tam sayı, tekrarsız.
- kazanimId: yukarıdaki formata uygun.
- questionText: soru metni.
- finalAnswer: en kısa net sonuç (örn. "5\\\\sqrt{3}" veya "x = 12").
- detailedSolution: adım adım detaylı çözüm.
- diagnosticComment: "Öğrenci bu soruda zorlandıysa: [Kazanım Adı] konusundaki [Eksik Kural/İşlem] eksiktir." formatında.

TEKNİK FORMAT: Çıktı SADECE geçerli bir JSON dizisi (tam 30 eleman) olacak — başka hiçbir açıklama, markdown çiti veya metin ekleme. LaTeX kullan, çift ters eğik çizgi tercih et (\\\\sqrt{}, \\\\frac{}{}).`;

function subtopicLabel(s: FlattenedSubtopic): string {
  return `${s.grade}. Sınıf > ${s.topicName} > ${s.subtopicName}`;
}

export function buildRound1UserPrompt(subtopic: FlattenedSubtopic): string {
  return `ALT KONU: ${subtopicLabel(subtopic)}

Bu, bu alt konu için İLK tur. Bu alt konuyu 3-6 mikro kazanıma (kazanımId) böl ve 30 soruyu bunlara dağıt (bir kazanım birden fazla soruda geçebilir, farklı zorluk bantlarında). Seçtiğin kazanımId kümesi ve HANGİ SIRAYLA/KAÇ KEZ kullandığın SONRAKİ TURLARDA aynen tekrar kullanılacak — bu yüzden mantıklı, konuyu iyi kapsayan bir kütüphane seç.

Sadece JSON dizisini döndür.`;
}

export function buildRoundNUserPrompt(subtopic: FlattenedSubtopic, blueprint: string[], roundNumber: number): string {
  const blueprintLines = blueprint.map((k, i) => `soruNo ${i + 1}: ${k}`).join("\n");
  return `ALT KONU: ${subtopicLabel(subtopic)}

Bu, bu alt konu için Tur ${roundNumber}. AŞAĞIDAKİ kazanımId sırasını BİREBİR ve SIRASIYLA kullan (her soruNo pozisyonu için hangi kazanımId zorunlu, bu listede belirtiliyor) — bu turdaki 30 soru bu diziye tam uymalı:

${blueprintLines}

Sayıları/bağlamı/senaryoyu ÖNCEKİ turlardan FARKLI yap, ama kazanımId dizisini DEĞİŞTİRME. Sadece JSON dizisini döndür.`;
}

export function buildRetryCorrectionSuffix(errorSummary: string): string {
  return `\n\nÖNCEKİ YANITIN GEÇERSİZDİ, ŞU HATA(LAR) DÜZELTİLMELİ: ${errorSummary}\nLütfen SADECE düzeltilmiş, geçerli JSON dizisini tekrar döndür.`;
}
