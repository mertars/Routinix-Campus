import type { FlattenedTopic } from "./curriculum-flatten";

// Faz Z4 — "genel" variant'ı (Test 1'in TEK türü, tema genelini kapsayan
// 30 soruluk havuz) için prompt üretimi. Kullanıcının DeepSeek/Claude'da
// elle kullandığı iki kademeli prompt'un (bkz. konuşma geçmişi: "Test 1" +
// kazanımId tutarlılık eki) otomasyon için kodlanmış hâli — TEK fark:
// (1) turlar arası tutarlılığı modelin "hatırlamasına" bırakmıyoruz, round
// 1'de üretilen (subtopicId, kazanımId) dizisi (blueprint) DB'ye kilitlenir
// ve 2. ve sonraki her turda BİREBİR yeniden enjekte edilir; (2) "genel"
// bir TEMANIN TÜMÜNÜ (o temanın TÜM alt konularını) kapsadığı için her
// soru KENDİ alt konusuna (subtopicAdi) etiketlenir — 30 soru tek bir alt
// konuya değil, temanın tüm alt konularına DAĞITILIR.
export const SYSTEM_PROMPT_GENEL = `SEN MÜKEMMEL BİR LİSE MATEMATİK ÖLÇME-DEĞERLENDİRME VE PEDAGOJİ UZMANISIN.

GÖREV: Verilen TEK bir KONUNUN (temanın) TÜMÜNÜ ölçen 30 soruluk bir "havuz turu" üreteceksin. Bu 30 soru, verilen temanın TÜM alt konularına mümkün olduğunca EŞİT dağıtılmalı (örn. 6 alt konu varsa ~5'er soru, 4 alt konu varsa 7-8'er soru) — HER alt konudan EN AZ 1 soru olmalı. Bu sorular sabit bir sınav kağıdı DEĞİL, rastgele seçimle öğrenciye sunulacak bir SORU HAVUZUNUN parçasıdır.

SORU YAPISI:
- A, B, C, D şıkları KESİNLİKLE OLMAYACAK. Sorular açık uçlu/klasik matematik sorularıdır.
- soruNo 1-10 (GİRİŞ): 1 adımlı, doğrudan tanım/sembol okuma/çok basit işlem.
- soruNo 11-20 (KURALLAR VE ÖZEL DURUMLAR): Konunun özel kuralları/formülleri (gerekirse aynı kural farklı sayılarla tekrarlanarak 10'a tamamlanır).
- soruNo 21-30 (KAPSAMLI): Kuralları birleştiren 3-4 adımlı, tamamen işlem odaklı sorular (paragraf/yeni nesil metin YOK).
- Her bant (1-10 / 11-20 / 21-30) içinde de alt konular mümkün olduğunca karışık dağılsın (aynı bandın tamamı tek bir alt konudan gelmesin).

KAZANIM ID FORMATI: [KONU_KODU]_[KAZANIM_KODU], BÜYÜK HARF + alt çizgi. Örnek: "GEO_PISAGOR", "SAYI_USLU_CARPMA". Farklı alt konulardaki kazanımlar birbirinden AÇIKÇA farklı kodlar kullanmalı (çakışma olmasın).

VERİ ALANLARI (her soru objesi için, İSTİSNASIZ hepsi dolu olacak):
- soruNo: 1-30 arası tam sayı, tekrarsız.
- subtopicAdi: bu sorunun ait olduğu alt konunun adı — AŞAĞIDA VERİLEN LİSTEDEKİ isimlerden BİRİYLE BİREBİR AYNI olmalı (başka bir isim uydurma).
- kazanimId: yukarıdaki formata uygun.
- questionText: soru metni.
- finalAnswer: en kısa net sonuç (örn. "5\\\\sqrt{3}" veya "x = 12").
- detailedSolution: adım adım detaylı çözüm.
- diagnosticComment: "Öğrenci bu soruda zorlandıysa: [Kazanım Adı] konusundaki [Eksik Kural/İşlem] eksiktir." formatında.

TEKNİK FORMAT: Çıktı SADECE geçerli bir JSON dizisi (tam 30 eleman) olacak — başka hiçbir açıklama, markdown çiti veya metin ekleme. LaTeX kullan, çift ters eğik çizgi tercih et (\\\\sqrt{}, \\\\frac{}{}).`;

function topicLabel(t: FlattenedTopic): string {
  return `${t.grade}. Sınıf > ${t.topicName}`;
}

function subtopicListBlock(t: FlattenedTopic): string {
  return t.subtopics.map((s) => `- ${s.subtopicName}`).join("\n");
}

export function buildGenelRound1UserPrompt(topic: FlattenedTopic): string {
  return `KONU: ${topicLabel(topic)}

Bu konunun alt konuları (SADECE bu listedeki isimleri subtopicAdi olarak kullan):
${subtopicListBlock(topic)}

Bu, bu konu için İLK tur. Her alt konuyu 1-3 mikro kazanıma (kazanımId) böl, 30 soruyu tüm alt konulara dağıt. Seçtiğin (subtopicAdi, kazanımId) eşlemesi ve HANGİ SIRAYLA/KAÇ KEZ kullandığın SONRAKİ TURLARDA aynen tekrar kullanılacak — bu yüzden mantıklı, konuyu iyi kapsayan bir yapı seç.

Sadece JSON dizisini döndür.`;
}

export function buildGenelRoundNUserPrompt(topic: FlattenedTopic, blueprint: { subtopicId: string; kazanimId: string }[], roundNumber: number): string {
  const idToName = new Map(topic.subtopics.map((s) => [s.subtopicId, s.subtopicName]));
  const blueprintLines = blueprint.map((slot, i) => `soruNo ${i + 1}: subtopicAdi="${idToName.get(slot.subtopicId) ?? slot.subtopicId}", kazanimId="${slot.kazanimId}"`).join("\n");
  return `KONU: ${topicLabel(topic)}

Bu, bu konu için Tur ${roundNumber}. AŞAĞIDAKİ (subtopicAdi, kazanımId) eşlemesini BİREBİR ve SIRASIYLA kullan — bu turdaki 30 soru bu diziye tam uymalı:

${blueprintLines}

Sayıları/bağlamı/senaryoyu ÖNCEKİ turlardan FARKLI yap, ama subtopicAdi/kazanımId dizisini DEĞİŞTİRME. Sadece JSON dizisini döndür.`;
}

export function buildRetryCorrectionSuffix(errorSummary: string): string {
  return `\n\nÖNCEKİ YANITIN GEÇERSİZDİ, ŞU HATA(LAR) DÜZELTİLMELİ: ${errorSummary}\nLütfen SADECE düzeltilmiş, geçerli JSON dizisini tekrar döndür.`;
}
