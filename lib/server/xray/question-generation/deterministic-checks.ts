// Faz Z10 — kullanıcı talebi: "sorunu azaltan kaliteyi arttıran her
// tekniği kullan". Gözlenen en sık hata sınıfı (finalAnswer'ın
// detailedSolution'ın kendi ulaştığı sonuçla TUTARSIZ olması) çoğu zaman
// SAF SAYISAL bir karşılaştırmayla, HİÇ AI çağrısı yapmadan tespit
// edilebilir — bu modül tam olarak bunu yapar. AI denetiminden (verify-
// content.ts) ÖNCE, ÜCRETSİZ bir ön filtre olarak çalışır: burada
// yakalanan bir tutarsızlık, ayrı bir AI çağrısına hiç gerek kalmadan
// "sorunlu" işaretlenir (token maliyeti sıfır, %100 güvenilir — YKS'lik
// bir yorum/muhakeme değil, düz aritmetik karşılaştırma).
//
// ⚠️ BİLİNÇLİ SINIRLAMA: sadece finalAnswer BASİT bir sayı/kesirse (değişken
// içermeyen) kontrol edilir — "x = 12", "A = {1,2,3}" gibi cebirsel/küme
// ifadeleri güvenle sayısal olarak ayrıştırılamaz, YANLIŞ POZİTİF riskini
// (doğru bir soruyu yanlışlıkla reddetme) almaktansa bu durumlarda kontrol
// SESSİZCE ATLANIR (AI denetimine bırakılır).

function parseSimpleNumber(raw: string): number | null {
  let text = raw.trim();
  // "x = 12", "Cevap: 12" gibi önekleri temizle
  text = text.replace(/^[a-zA-ZçÇğĞıİöÖşŞüÜ()\s]*[:=]\s*/, "").trim();
  // LaTeX \frac{a}{b} -> a/b
  const fracMatch = text.match(/^\\?frac\{(-?\d+(?:[.,]\d+)?)\}\{(-?\d+(?:[.,]\d+)?)\}$/);
  if (fracMatch) {
    const num = Number(fracMatch[1].replace(",", "."));
    const den = Number(fracMatch[2].replace(",", "."));
    if (den === 0 || Number.isNaN(num) || Number.isNaN(den)) return null;
    return num / den;
  }
  // düz "a/b" kesri
  const simpleFrac = text.match(/^(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)$/);
  if (simpleFrac) {
    const num = Number(simpleFrac[1].replace(",", "."));
    const den = Number(simpleFrac[2].replace(",", "."));
    if (den === 0 || Number.isNaN(num) || Number.isNaN(den)) return null;
    return num / den;
  }
  // düz sayı (ör. "12", "-3.5", "3,5")
  const plain = text.match(/^-?\d+(?:[.,]\d+)?$/);
  if (plain) {
    const v = Number(text.replace(",", "."));
    return Number.isNaN(v) ? null : v;
  }
  return null;
}

// detailedSolution'ın İÇİNDEKİ (genellikle son) "= <sayı>" kalıplarını
// bulur, EN SONUNCUSUNU döner — çözümün ULAŞTIĞI nihai sayısal sonuç
// genellikle metnin sonunda geçer.
// Faz Z11 — gerçek üretimde bulunan YANLIŞ POZİTİF: bu fonksiyon eskiden
// SADECE düz sayı kalıplarını ("= 12") tanıyordu, "= \frac{7}{4}" gibi
// LaTeX kesirlerini GÖRMEZDEN GELİYORDU — bu yüzden çözüm metninde ÖNCE
// geçen alakasız bir "= 12" (ör. "OKEK(...) = 12" ara adımı), asıl SONUÇ
// olan "= \frac{7}{4}"den DAHA SONRA eşleşen bir kalıp SANILIYOR, doğru
// bir soru YANLIŞLIKLA "sorunlu" işaretleniyordu. Artık HER ÜÇ kalıp
// (düz sayı, \frac{a}{b}, düz a/b) birlikte taranıp GERÇEKTEN METİNDE EN
// SON geçen aday seçiliyor.
// Faz Z13 — canlı düzeltme turlarında bulunan İKİNCİ YANLIŞ POZİTİF: "3x + 2
// = 4(x - 2)" veya "2 + 8 = 4x - 3x" gibi denklemlerde "=" hemen ardından
// gelen "4(...)" veya "4x" bir KATSAYI/alt-ifadedir, NİHAİ sonuç DEĞİLDİR —
// eski regex bunu "= 4" SANIYORDU (çünkü sadece "başka bir rakam" gelmediği
// sürece eşleşiyordu, parantez/harf kontrolü yoktu). Bu yanlış eşleşme,
// çözümün asıl son satırı "10 = x" gibi (sayı SOLDA, değişken SAĞDA)
// yazıldığında hiç eşleşmediği için LİSTEDEKİ SON aday olarak kalıyor ve
// doğru bir soru ("finalAnswer 10", çözüm de 10'a ulaşıyor) YANLIŞLIKLA
// tutarsız işaretleniyordu. Artık sayı hemen ardından "(" veya bir harf
// geliyorsa (katsayı/değişken bitişiği sinyali) o eşleşme ATLANIYOR.
function extractTrailingNumber(text: string): number | null {
  const pattern = /=\s*(?:\\?frac\{(-?\d+(?:[.,]\d+)?)\}\{(-?\d+(?:[.,]\d+)?)\}|(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)|(-?\d+(?:[.,]\d+)?)(?!\d|\(|[a-zA-ZçÇğĞıİöÖşŞüÜ]))/g;
  let lastValue: number | null = null;
  for (const m of text.matchAll(pattern)) {
    let value: number | null = null;
    if (m[1] !== undefined && m[2] !== undefined) {
      const den = Number(m[2].replace(",", "."));
      if (den !== 0) value = Number(m[1].replace(",", ".")) / den;
    } else if (m[3] !== undefined && m[4] !== undefined) {
      const den = Number(m[4].replace(",", "."));
      if (den !== 0) value = Number(m[3].replace(",", ".")) / den;
    } else if (m[5] !== undefined) {
      value = Number(m[5].replace(",", "."));
    }
    if (value !== null && !Number.isNaN(value)) lastValue = value;
  }
  return lastValue;
}

const EPSILON = 0.0001;

export type DeterministicIssue = { soruNo: number; reason: string };

// Verilen soru kümesindeki her soru için finalAnswer/detailedSolution
// arasında SAYISAL bir tutarsızlık olup olmadığını kontrol eder. finalAnswer
// veya detailedSolution'ın son sayısı GÜVENLE ayrıştırılamazsa (cebirsel
// ifade, küme, metin cevabı vb.) o soru SESSİZCE atlanır — bu fonksiyon
// SADECE yüksek güvenilirlikli, kesin sayısal uyuşmazlıkları yakalar.
export function checkAnswerConsistency(questions: { soruNo: number; finalAnswer: string; detailedSolution: string }[]): DeterministicIssue[] {
  const issues: DeterministicIssue[] = [];
  for (const q of questions) {
    const answerNum = parseSimpleNumber(q.finalAnswer);
    if (answerNum === null) continue;
    const solutionNum = extractTrailingNumber(q.detailedSolution);
    if (solutionNum === null) continue;
    if (Math.abs(answerNum - solutionNum) > EPSILON) {
      issues.push({
        soruNo: q.soruNo,
        reason: `finalAnswer (${q.finalAnswer} ≈ ${answerNum}) detailedSolution'ın ulaştığı son sayısal sonuçla (${solutionNum}) TUTARSIZ — deterministik kontrol.`,
      });
    }
  }
  return issues;
}

// LaTeX/format sağlık kontrolü — dengesiz süslü parantez veya bariz bozuk
// karakter (mojibake) tespit eder. Matematik doğruluğu DEĞİL, RENDER
// kalitesini korur.
export function checkFormatHealth(questions: { soruNo: number; questionText: string; detailedSolution: string; finalAnswer: string }[]): DeterministicIssue[] {
  const issues: DeterministicIssue[] = [];
  for (const q of questions) {
    for (const [field, text] of [
      ["questionText", q.questionText],
      ["detailedSolution", q.detailedSolution],
      ["finalAnswer", q.finalAnswer],
    ] as const) {
      let depth = 0;
      let balanced = true;
      for (const ch of text) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
        if (depth < 0) {
          balanced = false;
          break;
        }
      }
      if (!balanced || depth !== 0) {
        issues.push({ soruNo: q.soruNo, reason: `${field} alanında dengesiz süslü parantez ({}) — bozuk LaTeX olabilir — deterministik kontrol.` });
        break;
      }
      if (/�|Ã¢|Ã¼|Ã§/.test(text)) {
        issues.push({ soruNo: q.soruNo, reason: `${field} alanında bozuk karakter (mojibake) tespit edildi — deterministik kontrol.` });
        break;
      }
    }
  }
  return issues;
}

// Faz Z11 — kullanıcının hedefli talebi üzerine ("sen kontrol et") ELLE
// yapılan bir örneklem incelemesinde AI denetiminin (verify-content.ts)
// ATLADIĞI gerçek bir kural ihlali bulundu: sistem prompt'u "A, B, C, D
// şıkları KESİNLİKLE OLMAYACAK" diyor ama bir soru questionText içinde
// "a) 3 b) -7 c) 1/2 d) √(-1)" gibi ÇOKTAN SEÇMELİ şıklar içeriyordu — AI
// denetimi cevap DOĞRULUĞUNA/mantığına odaklandığı için bu YAPISAL/biçim
// kuralını kontrol etmiyordu. Bu ÜCRETSİZ, deterministik kontrol o boşluğu
// kapatır: questionText'te "a)"/"b)"/"c)"/"d)" (veya büyük harfli) gibi
// art arda şık kalıpları tespit edilirse soru reddedilir.
const MULTIPLE_CHOICE_PATTERN = /\b[aAbBcCdD]\)\s*\S+.*\b[bBcCdD]\)/;

export function checkNoMultipleChoice(questions: { soruNo: number; questionText: string }[]): DeterministicIssue[] {
  const issues: DeterministicIssue[] = [];
  for (const q of questions) {
    if (MULTIPLE_CHOICE_PATTERN.test(q.questionText)) {
      // Faz Z14 — canlı üretimde bu ihlal AYNI soruNo'da ARKA ARKAYA 9 kez
      // tekrarlandı (eş üçgen "hangi kenar/açı karşılık gelir" tarzı
      // sorularda) — reason eskiden hangi METNİN ihlal ettiğini
      // GÖSTERMİYORDU, bu da hem debug'ı hem hedefli düzeltmeyi
      // zorlaştırıyordu. Artık ihlal eden metin somut olarak gösteriliyor.
      issues.push({ soruNo: q.soruNo, reason: `questionText çoktan seçmeli şıklar (a) b) c) d) tarzı) içeriyor — sistem kuralına göre bu KESİNLİKLE YASAK, sorular açık uçlu olmalı: "${q.questionText}" — deterministik kontrol.` });
    }
  }
  return issues;
}

// Faz Z11 — elle örneklem incelemesinde bulunan İKİNCİ hata sınıfı: bu
// checkAnswerConsistency'den FARKLI bir hata — finalAnswer/detailedSolution
// birbiriyle TUTARLIYDI ama detailedSolution'ın İÇİNDEKİ basit bir toplama/
// çıkarma adımı bizzat YANLIŞ hesaplanmıştı ("s(A∪B)+s(A∩B) = 7 + 3 = 8"
// yazılmış, gerçekte 7+3=10). checkAnswerConsistency bunu YAKALAYAMAZ
// (finalAnswer zaten o yanlış "8" ile eşleşiyordu, iç tutarlılık vardı —
// sorun MATEMATİKSEL doğruluktaydı, transkripsiyon değil).
//
// ⚠️ BİLİNÇLİ SINIRLAMA (yanlış pozitif riskini kontrol altında tutmak
// için): SADECE +/− (toplama/çıkarma) kontrol edilir, çarpma/bölme DEĞİL
// (önceliği/zincirleme ifadeleri karıştırma riski daha yüksek). Bir
// eşleşmenin HEMEN ÖNCESİNDE başka bir sayı/işlem operatörü varsa (yani
// bu, DAHA UZUN bir ifadenin ORTASI/SONU olabilir) o eşleşme ATLANIR.
// Gerçek üretimde YAKALANAN yanlış pozitif: "3*12 + 4 = 40" (doğru, 3×12=36,
// 36+4=40) — önceki sürüm SADECE +/− öncesini kontrol ediyordu, "*12"
// öncesi bir ÇARPMA olduğunu görmediği için "12 + 4 = 40"ı YALNIZ BAŞINA
// (yanlışlıkla) değerlendirip reddediyordu. Artık +,-,*,×,·,/,÷ VE bitişik
// bir rakam (örn. üslü ifadenin bir parçası) hepsi "bu bir alt-ifade"
// sinyali sayılıyor.
const ARITHMETIC_STEP_PATTERN = /(-?\d+(?:[.,]\d+)?)\s*([+-])\s*(-?\d+(?:[.,]\d+)?)\s*=\s*(-?\d+(?:[.,]\d+)?)(?!\d)/g;
const PRECEDING_OPERATOR_PATTERN = /[\d+\-*×·/÷^]\s*$/;

export function checkArithmeticSteps(questions: { soruNo: number; detailedSolution: string }[]): DeterministicIssue[] {
  const issues: DeterministicIssue[] = [];
  for (const q of questions) {
    const text = q.detailedSolution;
    for (const m of text.matchAll(ARITHMETIC_STEP_PATTERN)) {
      const matchStart = m.index ?? 0;
      const before = text.slice(Math.max(0, matchStart - 8), matchStart);
      if (PRECEDING_OPERATOR_PATTERN.test(before)) continue; // muhtemelen daha uzun bir ifadenin alt-parçası — atla

      const a = Number(m[1].replace(",", "."));
      const op = m[2];
      const b = Number(m[3].replace(",", "."));
      const stated = Number(m[4].replace(",", "."));
      const expected = op === "+" ? a + b : a - b;
      if (Math.abs(expected - stated) > EPSILON) {
        issues.push({
          soruNo: q.soruNo,
          reason: `detailedSolution içinde hatalı aritmetik: "${a} ${op} ${b} = ${stated}" yazılmış ama gerçek sonuç ${expected} olmalı — deterministik kontrol.`,
        });
        break;
      }
    }
  }
  return issues;
}

// Faz Z12 — kullanıcının "sistem senden sıyrılmıyor dimi, daha çok
// sorgula" uyarısı üzerine yapılan derin taramada bulundu: doğruluk hep
// kontrol ediliyordu ama TURLAR ARASI ÇEŞİTLİLİK hiç kontrol edilmiyordu.
// Gerçek örnek: Tur 3 ve Tur 4'te AYNI soruNo'da "2/3 + 1/6" — SAYILARI
// BİLE AYNI, sadece "kaçtır?" / "bulunuz." gibi yüzeysel ifade farkı vardı.
// Havuzun TÜM amacı ("her denemede farklı sorularla gelsin") bu şekilde
// zedeleniyor — bir öğrenci aynı konuyu 2. kez çözerse rastgele havuzdan
// birebir AYNI soruyu çekebilir. Bu kontrol, mevcut/önceki turların
// questionText'inden çıkardığı SAYI+OPERATÖR imzasını (yüzeysel Türkçe
// ifade farkını YOK SAYARAK) karşılaştırır — imza aynıysa "neredeyse
// birebir aynı soru" sayılır.
// Faz Z13 — dışa açıldı: prompt.ts, round N-1 prompt'una "bunları
// tekrarlama" listesi enjekte etmek için AYNI imza fonksiyonunu kullanır —
// tek kaynak, kontrol ile üretim prompt'u arasında imza mantığı SÜRÜKLENMEZ.
//
// Faz Z14 — canlı üretimde bulunan ÖNEMLİ eksiklik: bu imza SADECE
// aritmetik operatörleri (+,-,*,/,^) yakalıyordu, mantık/karşılaştırma
// sembollerini (∧,∨,¬,∀,∃,=,<,>,≤,≥,≠) YOK SAYIYORDU. Sonuç: "(p∧q)∨r" ile
// "(p∨q)∧r" gibi YAPISAL OLARAK FARKLI iki önerme, aynı p/q/r değerlerini
// kullandığında AYNI imzayı üretiyordu (çünkü sadece "1|0|1" gibi rakamlar
// kalıyordu, hangi operatörün nerede geçtiği kayboluyordu). 3 değişkenli
// (p,q,r) bir kazanımda sadece 8 olası doğruluk-değeri ataması olduğundan,
// bu eksiklik birkaç tur içinde YAPAY bir tükenmeye (gerçekte hâlâ farklı
// olabilecek sorular yanlışlıkla "aynı" sayılıp reddediliyordu) yol açtı —
// canlı üretimde mt9-algoritma-bilisim tur 6 bu yüzden 3 tam denemeden
// sonra BAŞARISIZ oldu. Artık mantık/karşılaştırma sembolleri de imzaya
// dahil — gerçekten aynı değer+operatör kombinasyonu kullanılmadıkça artık
// "çakışma" sayılmıyor.
export function numericSignature(text: string): string {
  const tokens = text.match(/\d+(?:[.,]\d+)?|[+\-*/×÷^]|\\frac|\\sqrt|[∧∨¬∀∃∈⇒⇔≤≥≠=<>]|\\wedge|\\vee|\\neg|\\forall|\\exists/g) ?? [];
  return tokens.join("|");
}

// Faz Z13 — kök neden düzeltmesi: eskiden reason SADECE "önceki bir turla
// aynı" diyordu, HANGİ soru/hangi tur olduğunu SÖYLEMİYORDU — bu yüzden
// hedefli düzeltme (fixFlaggedQuestions) modelin ÖNCEKİ soruyu GÖRMEDEN
// "farklı yap" demesine, yani AYNI kör tekrara yol açıyordu. Artık reason
// önceki sorunun GERÇEK METNİNİ içeriyor — hem loglarda hem düzeltme
// prompt'unda somut bir "bundan kaçın" referansı oluyor.
export function checkCrossRoundDuplication(currentQuestions: { soruNo: number; questionText: string }[], priorRoundsQuestions: { soruNo: number; questionText: string }[][]): DeterministicIssue[] {
  const issues: DeterministicIssue[] = [];
  for (const q of currentQuestions) {
    const currentSig = numericSignature(q.questionText);
    if (currentSig.length === 0) continue; // sayı içermeyen soru (ör. yorum/kanıt sorusu) — güvenle karşılaştırılamaz
    for (const priorQuestions of priorRoundsQuestions) {
      const prior = priorQuestions.find((p) => p.soruNo === q.soruNo);
      if (!prior) continue;
      if (numericSignature(prior.questionText) === currentSig) {
        issues.push({
          soruNo: q.soruNo,
          reason: `Bu soru, önceki bir turdaki AYNI soruNo'daki şu soruyla (aynı sayılar/işlemler) neredeyse birebir aynı: "${prior.questionText}" — havuzda çeşitlilik olmalı, TAMAMEN FARKLI sayılar/bağlam kullan — deterministik kontrol.`,
        });
        break;
      }
    }
  }
  return issues;
}
