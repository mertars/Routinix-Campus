import type { FlattenedTopic, FlattenedSubtopic } from "./curriculum-flatten";

// Faz Z4/Z5 — Akademik Röntgen soru havuzu prompt'ları. İKİ variant burada
// tanımlı: "genel" (temanın TÜMÜNÜ kapsayan 30 soruluk havuz, tüm alt
// konulara dağıtılır) ve "alt_konu" (TEK bir alt konuya özel, orta seviye
// 10 soruluk havuz). Turlar arası tutarlılık modelin "hatırlamasına"
// bırakılmıyor — round 1'de üretilen blueprint (soru-slotu yapısı) DB'ye
// kilitlenir, 2. ve sonraki her turda BİREBİR yeniden enjekte edilir.
//
// ⚠️ MÜFREDAT SINIRI KURALI (kullanıcı talebi, ÇOK ÖNEMLİ): aynı konu adı
// (örn. "Türev") birden fazla sınıfta FARKLI derinliklerde geçebilir (bkz.
// lib/mock-data.ts CURRICULUM_TREE — sarmal müfredat). Model SADECE verilen
// alt konunun/sınıf seviyesinin müfredatta KAPSADIĞI çerçevede soru
// üretmeli — konu adı aynı diye başka bir sınıfın/daha ileri bir düzeyin
// içeriğini KULLANMAMALI. Bu kural HER İKİ prompt'a da (MEB_SCOPE_CLAUSE
// üzerinden) tek bir yerden enjekte edilir — iki promptun metni burada
// birbirinden bağımsız kopyalanıp SÜRÜKLENMEDEN (drift) tutarlı kalsın diye.
const MEB_SCOPE_CLAUSE = `MÜFREDAT SINIRI (ÇOK ÖNEMLİ, ASLA İHLAL ETME): Aşağıda verilen konu/alt konu, Türkiye MEB'in (Milli Eğitim Bakanlığı) resmi lise matematik müfredatında BELİRTİLEN SINIF SEVİYESİNE ait, dershane pratiğinde kullanılan bir alt başlıktır. Aynı konu adı (örn. "Türev", "Trigonometri") FARKLI sınıflarda FARKLI derinliklerde/farklı alt başlıklar altında da geçebilir — SEN SADECE verilen sınıf seviyesinin, verilen alt konunun müfredatta KAPSADIĞI konuları/yöntemleri/formülleri kullanacaksın. Konu adı aynı diye daha ileri bir sınıfın, farklı bir müfredatın (üniversite düzeyi dahil) veya bu alt konunun kapsamadığı bir yöntemin/formülün İÇERİĞİNİ ASLA KULLANMA. Emin olmadığın bir yöntem/formül varsa, KESİNLİKLE müfredat dışına çıkmaktansa daha basit/temel bir yaklaşım kullan.`;

// Faz Z9 — gerçek üretimlerde bağımsız içerik denetiminin (verify-content.ts)
// yakaladığı hataların KÖK NEDEN analizi sonucu eklendi. Gözlenen 2 ana
// hata sınıfı: (1) finalAnswer alanı detailedSolution'ın kendi ulaştığı
// sonuçla TUTARSIZ yazılmış (model çözümde doğru hesaplıyor ama ayrı
// finalAnswer alanına farklı/yanlış bir değer yazıyor — bir "transkripsiyon"
// hatası, muhakeme hatası değil); (2) gerçek hesap hataları, özellikle
// kesir sadeleştirme (sadeleşmeyen bir kesri sadeleşmiş gibi göstermek) ve
// üslü ifade hesaplarında. Bu madde HER İKİ prompt'a da enjekte edilir —
// gelecekte yeni bir hata sınıfı gözlenirse BURAYA eklenmeli (tek kaynak).
const SELF_CHECK_CLAUSE = `KENDİ KENDİNİ KONTROL ET (ÇOK ÖNEMLİ — geçmiş üretimlerde en sık görülen hatalar):
1. finalAnswer'ı ASLA detailedSolution'dan BAĞIMSIZ hesaplama. Önce detailedSolution'ı TAMAMLA, sonra finalAnswer'ı o çözümün SON SATIRINDAKİ sonuçtan BİREBİR KOPYALA — iki alan arasında EN UFAK bir sayısal farklılık dahi KABUL EDİLEMEZ.
   - YANLIŞ örnek (gerçek üretimde yakalandı): detailedSolution "...a+b = 5 bulunur" diye bitiyor ama finalAnswer alanına "4" yazılmış. Bu KABUL EDİLEMEZ bir tutarsızlıktır.
   - DOĞRU: detailedSolution "...a+b = 5 bulunur" diye bitiyorsa finalAnswer da BİREBİR "5" olmalı.
2. Kesir sadeleştirirken payı ve paydayı GERÇEKTEN ortak bir tam sayıya bölüp bölemediğini iki kez kontrol et. Payı ve paydası aralarında asal olan (ortak böleni olmayan) bir kesir ZATEN en sade halidir — sadeleştirilebilir SANIP yanlış bir sadeleştirme YAPMA (gerçek üretimde yakalanan hata: "35/66 sadeleştirilerek 1/2" denmiş, ama 35 ile 66 aralarında asaldır, sadeleşmez).
3. Üslü ifadelerde toplama/çarpma/bölme kurallarını (üs toplama/çıkarma) uygularken, özellikle birden fazla adım varsa SON adımı yazmadan önce baştan bir kez daha elle doğrula.
4. "Hangi sayı/ifade X değildir?" tarzı soruları YAZARKEN, cevap seçeneklerini "a) ... b) ... c) ... d) ..." şeklinde SIRALAMA — bu, YASAK olan çoktan seçmeli formata kayar (gerçek üretimde defalarca yakalandı, hep AYNI kazanım tipinde: "hangisi rasyonel/gerçek sayı değildir"). Bunun yerine TEK BİR somut sayı/ifade için doğrudan sor (örn. "√2 sayısı rasyonel bir sayı mıdır? Nedenini kısaca açıklayınız.") — asla birden fazla seçeneği yan yana a)/b)/c)/d) etiketleriyle listeleme.`;

// ── "genel" — 30 soru, temanın TÜMÜ, tüm alt konulara dağılır ──

export const SYSTEM_PROMPT_GENEL = `SEN MÜKEMMEL BİR LİSE MATEMATİK ÖLÇME-DEĞERLENDİRME VE PEDAGOJİ UZMANISIN.

GÖREV: Verilen TEK bir KONUNUN (temanın) TÜMÜNÜ ölçen 30 soruluk bir "havuz turu" üreteceksin. Bu 30 soru, verilen temanın TÜM alt konularına mümkün olduğunca EŞİT dağıtılmalı (örn. 6 alt konu varsa ~5'er soru, 4 alt konu varsa 7-8'er soru) — HER alt konudan EN AZ 1 soru olmalı. Bu sorular sabit bir sınav kağıdı DEĞİL, rastgele seçimle öğrenciye sunulacak bir SORU HAVUZUNUN parçasıdır.

${MEB_SCOPE_CLAUSE}

${SELF_CHECK_CLAUSE}

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
  return `SINIF SEVİYESİ: ${topic.grade}. Sınıf
KONU: ${topicLabel(topic)}

Bu konunun alt konuları (SADECE bu listedeki isimleri subtopicAdi olarak kullan):
${subtopicListBlock(topic)}

Bu, bu konu için İLK tur. Her alt konuyu 1-3 mikro kazanıma (kazanımId) böl, 30 soruyu tüm alt konulara dağıt. Seçtiğin (subtopicAdi, kazanımId) eşlemesi ve HANGİ SIRAYLA/KAÇ KEZ kullandığın SONRAKİ TURLARDA aynen tekrar kullanılacak — bu yüzden mantıklı, konuyu iyi kapsayan bir yapı seç.

Sadece JSON dizisini döndür.`;
}

export function buildGenelRoundNUserPrompt(topic: FlattenedTopic, blueprint: { subtopicId: string; kazanimId: string }[], roundNumber: number): string {
  const idToName = new Map(topic.subtopics.map((s) => [s.subtopicId, s.subtopicName]));
  const blueprintLines = blueprint.map((slot, i) => `soruNo ${i + 1}: subtopicAdi="${idToName.get(slot.subtopicId) ?? slot.subtopicId}", kazanimId="${slot.kazanimId}"`).join("\n");
  return `SINIF SEVİYESİ: ${topic.grade}. Sınıf
KONU: ${topicLabel(topic)}

Bu, bu konu için Tur ${roundNumber}. AŞAĞIDAKİ (subtopicAdi, kazanımId) eşlemesini BİREBİR ve SIRASIYLA kullan — bu turdaki 30 soru bu diziye tam uymalı:

${blueprintLines}

Sayıları/bağlamı/senaryoyu ÖNCEKİ turlardan FARKLI yap, ama subtopicAdi/kazanımId dizisini DEĞİŞTİRME. Sadece JSON dizisini döndür.`;
}

// ── "alt_konu" — 10 soru, TEK bir alt konu, ORTA seviye ──
//
// Kullanıcı talebi birebir: "temel değil orta seviye sorular olucak...
// direkt 2 kök 2 değil, bunla yapılabilecek işlemler, toplamalar, formüllü
// sorular" — yani GİRİŞ/tanım-okuma bandı tamamen YOK, tüm 10 soru en az
// bir kuralın somut bir işlemle UYGULANMASINI gerektiriyor.

export const SYSTEM_PROMPT_ALT_KONU = `SEN MÜKEMMEL BİR LİSE MATEMATİK ÖLÇME-DEĞERLENDİRME VE PEDAGOJİ UZMANISIN.

GÖREV: Verilen TEK bir ALT KONUYA özel, 10 soruluk bir "havuz turu" üreteceksin. Bu sorular sabit bir sınav kağıdı DEĞİL, rastgele seçimle öğrenciye sunulacak bir SORU HAVUZUNUN parçasıdır.

${MEB_SCOPE_CLAUSE}

${SELF_CHECK_CLAUSE}

SORU YAPISI (ÇOK ÖNEMLİ):
- A, B, C, D şıkları KESİNLİKLE OLMAYACAK. Sorular açık uçlu/klasik matematik sorularıdır.
- TÜM 10 SORU ORTA SEVİYE olacak — doğrudan tanım/sembol okuma/ezber TEMEL sorular KESİNLİKLE YASAK.
  - YANLIŞ örnek (çok temel, YASAK): "√2 × √2 kaçtır?"
  - DOĞRU örnek (orta seviye, bir kuralın işlemle uygulanması): "3√5 + 2√5 − √20 ifadesinin sonucu kaçtır?"
- soruNo 1-5: konunun TEK bir kuralının/formülünün somut sayılarla/ifadelerle UYGULANMASI (toplama, çarpma, sadeleştirme, formül yerine koyma vb. — asla salt tanım sorma).
- soruNo 6-10: konunun birden fazla kuralını/kavramını BİRLEŞTİREN, ama 30 soruluk "genel konu" testinin en zor bandı kadar karmaşık OLMAYAN orta-üst seviye sorular.

KAZANIM ID FORMATI: [KONU_KODU]_[KAZANIM_KODU], BÜYÜK HARF + alt çizgi. Örnek: "GEO_PISAGOR", "SAYI_USLU_CARPMA".

VERİ ALANLARI (her soru objesi için, İSTİSNASIZ hepsi dolu olacak):
- soruNo: 1-10 arası tam sayı, tekrarsız.
- kazanimId: yukarıdaki formata uygun.
- questionText: soru metni.
- finalAnswer: en kısa net sonuç (örn. "5\\\\sqrt{3}" veya "x = 12").
- detailedSolution: adım adım detaylı çözüm.
- diagnosticComment: "Öğrenci bu soruda zorlandıysa: [Kazanım Adı] konusundaki [Eksik Kural/İşlem] eksiktir." formatında.

TEKNİK FORMAT: Çıktı SADECE geçerli bir JSON dizisi (tam 10 eleman) olacak — başka hiçbir açıklama, markdown çiti veya metin ekleme. LaTeX kullan, çift ters eğik çizgi tercih et (\\\\sqrt{}, \\\\frac{}{}).`;

function subtopicLabel(s: FlattenedSubtopic): string {
  return `${s.grade}. Sınıf > ${s.topicName} > ${s.subtopicName}`;
}

export function buildAltKonuRound1UserPrompt(subtopic: FlattenedSubtopic): string {
  return `ALT KONU: ${subtopicLabel(subtopic)}

Bu, bu alt konu için İLK tur. Bu alt konuyu 2-4 mikro kazanıma (kazanımId) böl ve 10 soruyu bunlara dağıt (bir kazanım birden fazla soruda geçebilir). Seçtiğin kazanımId kümesi ve HANGİ SIRAYLA/KAÇ KEZ kullandığın SONRAKİ TURLARDA aynen tekrar kullanılacak.

Sadece JSON dizisini döndür.`;
}

export function buildAltKonuRoundNUserPrompt(subtopic: FlattenedSubtopic, blueprint: string[], roundNumber: number): string {
  const blueprintLines = blueprint.map((k, i) => `soruNo ${i + 1}: ${k}`).join("\n");
  return `ALT KONU: ${subtopicLabel(subtopic)}

Bu, bu alt konu için Tur ${roundNumber}. AŞAĞIDAKİ kazanımId sırasını BİREBİR ve SIRASIYLA kullan:

${blueprintLines}

Sayıları/bağlamı/senaryoyu ÖNCEKİ turlardan FARKLI yap, ama kazanımId dizisini DEĞİŞTİRME. Sadece JSON dizisini döndür.`;
}

export function buildRetryCorrectionSuffix(errorSummary: string): string {
  return `\n\nÖNCEKİ YANITIN GEÇERSİZDİ, ŞU HATA(LAR) DÜZELTİLMELİ: ${errorSummary}\nLütfen SADECE düzeltilmiş, geçerli JSON dizisini tekrar döndür.`;
}

// ── Hedefli düzeltme — SADECE içerik denetiminin (verify-content.ts)
// "sorunlu" bulduğu soruları yeniden yazdırır, turun TAMAMINI DEĞİL. ──
//
// Faz Z9 — kullanıcı talebi: "hatalı sorudan dolayı baştan yapması sadece
// hatalı olan soruyu düzeltsin". Önceden 30 sorunun 1'i bile sorunlu
// bulunsa turun TAMAMI (30 soru) yeniden üretiliyordu — hem israf hem de
// zaten DOĞRU olan 29 sorunun bir daha üretilip tekrar denetlenmesi
// anlamsızdı. Bu prompt SADECE flawed soruların soruNo/kazanımId'sini
// (ve "genel" için subtopicAdi'sini) SABİT tutup İÇERİĞİNİ (questionText/
// finalAnswer/detailedSolution/diagnosticComment) yeniden yazdırır —
// blueprint yapısı (hangi soruNo hangi kazanıma ait) ASLA bozulmaz.
export const SYSTEM_PROMPT_FIX = `SEN MÜKEMMEL BİR LİSE MATEMATİK ÖLÇME-DEĞERLENDİRME VE PEDAGOJİ UZMANISIN.

GÖREV: Sana daha önce üretilmiş, kalite kontrolünde SORUNLU bulunmuş birkaç soru verilecek. Her biri için verilen SORUN AÇIKLAMASINI dikkatle oku ve SIFIRDAN, sorunu içermeyen YENİ bir soru/çözüm yaz — aynı kazanımı (konuyu) ölçmeye devam etmeli ama eski (hatalı) hali TEKRARLAMA.

${SELF_CHECK_CLAUSE}

VERİ ALANLARI (her soru için, İSTİSNASIZ hepsi dolu olacak): soruNo (verilenle AYNI), questionText, finalAnswer, detailedSolution, diagnosticComment. kazanımId'yi veya alt konuyu DEĞİŞTİRME/EMİTME — sadece bu 5 alanı döndür.

TEKNİK FORMAT: Çıktı SADECE geçerli bir JSON dizisi olacak (verilen soru sayısı kadar eleman) — başka açıklama ekleme. LaTeX kullan, çift ters eğik çizgi tercih et (\\\\sqrt{}, \\\\frac{}{}).`;

export type FlawedQuestionContext = { soruNo: number; kazanimId: string; subtopicName?: string; oldQuestionText: string; reason: string };

// Faz Z10 — "farklı yaklaşım" tekniği: bir soru düzeltmeden SONRA hâlâ
// sorunlu bulunduysa (2. deneme), aynı zihniyetle/sayı seçimiyle AYNI
// hatayı tekrarlama riski var — isRetry=true iken açıkça FARKLI bir
// sayı/senaryo/yaklaşım kullanmasını, önceki düzeltmedeki mantığı
// tekrarlamamasını istiyoruz. Başarısız bir düzeltme döngüsüne
// takılmayı önlemeye yönelik bir çeşitlilik enjeksiyonu.
export function buildFixUserPrompt(flawed: FlawedQuestionContext[], isRetry = false): string {
  const block = flawed
    .map((f) => `soruNo ${f.soruNo} (kazanımId: ${f.kazanimId}${f.subtopicName ? `, alt konu: ${f.subtopicName}` : ""}):\nEski (hatalı) soru: ${f.oldQuestionText}\nSORUN: ${f.reason}`)
    .join("\n\n");
  const retryNote = isRetry ? `\n\n⚠️ ÖNEMLİ: Bu sorular DAHA ÖNCE BİR KEZ "düzeltildi" ama düzeltme de hatalıydı. Bu sefer TAMAMEN FARKLI sayılar/senaryo kullan ve hesabını adım adım, her adımdan sonra tekrar kontrol ederek yap — aynı hatayı TEKRARLAMA.` : "";
  return `Aşağıdaki ${flawed.length} soruyu düzelt:\n\n${block}${retryNote}\n\nSadece JSON dizisini döndür.`;
}
