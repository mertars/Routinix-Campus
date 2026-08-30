// Akademik Röntgen — adaptif tanı testi motoru. "Matematik Röntgeni"
// ürününün araştırılan gerçek mekaniği: kolay soruyu çözen öğrenciye o
// KONUDA zorlaşan sorular gelmeye devam eder, çözemeyen öğrenciye o konuda
// DAHA FAZLA soru gösterilmez. Bu dosya SAF fonksiyonlar içerir (DB'ye
// dokunmaz) — route katmanı soruyu havuzdan çeker, cevabı kaydeder, bu
// modül sadece "sırada ne var" ve "sonuç ne" sorularına cevap verir.

export type AnsweredQuestion = { difficulty: number; isCorrect: boolean };
export type AvailableQuestion = { id: string; difficulty: number };

// Bir alt konuda en fazla bu kadar soru sorulur — adaptif test pratikte
// makul sürede bitsin diye (gerçek ürün de "tek oturumda" diyor, sonsuz
// soru sormuyor).
const MAX_QUESTIONS_PER_SUBTOPIC = 3;

// Bir sonraki soruyu seçer; bu konuda test BİTTİYSE null döner.
export function pickNextQuestion(answeredSoFar: AnsweredQuestion[], available: AvailableQuestion[]): AvailableQuestion | null {
  if (answeredSoFar.length >= MAX_QUESTIONS_PER_SUBTOPIC) return null;

  const last = answeredSoFar.at(-1);
  if (last && !last.isCorrect) return null; // yanlış cevaptan sonra bu konuda durulur

  if (!last) {
    // İlk soru — havuzdaki en kolayı.
    const sorted = [...available].sort((a, b) => a.difficulty - b.difficulty);
    return sorted[0] ?? null;
  }

  // Bir önceki doğruysa, ondan bir üst zorlukta, HENÜZ SORULMAMIŞ bir soru ara.
  const askedDifficulties = new Set(answeredSoFar.map((a) => a.difficulty));
  const candidates = available
    .filter((q) => q.difficulty > last.difficulty && !askedDifficulties.has(q.difficulty))
    .sort((a, b) => a.difficulty - b.difficulty);
  return candidates[0] ?? null;
}

// Bir alt konudaki cevaplardan 0-100 ustalık skoru hesaplar. Ham "doğru
// yüzdesi" DEĞİL — adaptif testte bu yanıltıcı olurdu (güçlü öğrenci sadece
// kapasitesindeki sorularla karşılaşır, o yüzden zaten yüksek % tutar).
// Bunun yerine "en yüksek hangi zorlukta doğru cevap verebildi" ölçülür —
// araştırılan üründeki "zorluk seviyesine göre ne kadar bildiği/bilmediği"
// tanımıyla birebir örtüşür.
export function computeSubtopicMastery(answers: AnsweredQuestion[], maxDifficulty = 5): number | null {
  if (answers.length === 0) return null;

  const first = answers[0];
  if (!first.isCorrect) {
    // En kolay soruyu bile yapamadı — temelden eksik, ama sıfır değil
    // (hiç denememekten ayrışsın diye küçük bir taban puan).
    return 10;
  }

  const highestCorrect = Math.max(...answers.filter((a) => a.isCorrect).map((a) => a.difficulty));
  return Math.min(100, Math.round((highestCorrect / maxDifficulty) * 100));
}
