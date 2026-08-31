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
function extractTrailingNumber(text: string): number | null {
  const matches = [...text.matchAll(/=\s*(-?\d+(?:[.,]\d+)?)(?!\d)/g)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1][1];
  const v = Number(last.replace(",", "."));
  return Number.isNaN(v) ? null : v;
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
