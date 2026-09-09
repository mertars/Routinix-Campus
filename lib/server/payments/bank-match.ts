// Ekstre satırını öğrenciyle eşleştirme.
//
// Veli havale açıklamasına ne yazacağını bilmez: bazen öğrencinin adını,
// bazen kendi adını, bazen öğrenci numarasını, bazen hiçbir şey. Bu
// yüzden eşleştirme KESİN DEĞİL, GÜVEN DERECELİdir ve son karar her
// zaman insanındır.
//
// ⚠️ Hiçbir eşleşme kendiliğinden tahsilata dönüşmez. Para yazmak geri
// alınması en zor işlemlerden biri; sistem aday önerir, sekreter onaylar.

export type MatchCandidate = {
  studentId: string;
  studentName: string;
  studentNumber: string;
  branchName: string;
  openDebt: number;
  /** 0-100. Yüksek olması "kesin" demek değil, "daha olası" demek. */
  score: number;
  /** Neden önerildiği — sekreter kararı görebilsin. */
  reasons: string[];
};

export type MatchableStudent = {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
  branchName: string;
  openDebt: number;
  /** Velilerin adları — açıklamada çoğu zaman VELİ adı yazar. */
  parentNames: string[];
};

// Türkçe karşılaştırma için normalleştirme: büyük/küçük harf, aksan ve
// noktalama farkları eşleşmeyi engellememeli.
export function normalizeForMatch(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SCORE = {
  studentNumber: 60,
  fullName: 35,
  parentName: 25,
  partialName: 12,
  exactAmount: 20,
} as const;

// Bir aday için güven puanı ve gerekçeleri.
function scoreStudent(student: MatchableStudent, description: string, amount: number): MatchCandidate | null {
  const haystack = normalizeForMatch(description);
  if (!haystack) return null;

  const reasons: string[] = [];
  let score = 0;

  // 1) Öğrenci numarası — en güçlü sinyal. "2026-1042" yazılmışsa
  //    tereddüt yok. Numaranın kendisi kısa olduğu için KELİME
  //    SINIRIYLA aranır; "1042" rastgele bir tutarın içinde geçebilir.
  const numberNormalized = normalizeForMatch(student.studentNumber);
  if (numberNormalized && new RegExp(`(^|\\s)${numberNormalized}(\\s|$)`).test(haystack)) {
    score += SCORE.studentNumber;
    reasons.push(`açıklamada öğrenci no (${student.studentNumber})`);
  }

  // 2) Ad soyad tam geçiyor mu.
  const fullName = normalizeForMatch(`${student.firstName} ${student.lastName}`);
  if (fullName && haystack.includes(fullName)) {
    score += SCORE.fullName;
    reasons.push("açıklamada öğrencinin adı soyadı");
  } else {
    // Kısmi: hem ad hem soyad ayrı ayrı geçiyorsa. Tek başına ad
    // ("Ahmet") çok yaygın olduğu için TEK BAŞINA sayılmaz.
    const first = normalizeForMatch(student.firstName);
    const last = normalizeForMatch(student.lastName);
    if (first && last && haystack.includes(first) && haystack.includes(last)) {
      score += SCORE.partialName;
      reasons.push("açıklamada ad ve soyad ayrı ayrı");
    }
  }

  // 3) Veli adı — havaleyi çoğu zaman veli yapar ve kendi adı görünür.
  for (const parentName of student.parentNames) {
    const normalized = normalizeForMatch(parentName);
    if (normalized && haystack.includes(normalized)) {
      score += SCORE.parentName;
      reasons.push(`açıklamada veli adı (${parentName})`);
      break;
    }
  }

  if (score === 0) return null;

  // 4) Tutar, açık borçtaki bir taksitle birebir aynıysa güven artar.
  //    TEK BAŞINA sinyal değildir: aynı tutarı yüz öğrenci ödüyor
  //    olabilir. Yalnızca isim/numara eşleşmesi varsa eklenir.
  if (student.openDebt > 0 && Math.abs(amount - student.openDebt) < 0.01) {
    score += SCORE.exactAmount;
    reasons.push("tutar kalan borcun tamamına eşit");
  }

  return {
    studentId: student.id,
    studentName: `${student.firstName} ${student.lastName}`,
    studentNumber: student.studentNumber,
    branchName: student.branchName,
    openDebt: student.openDebt,
    score: Math.min(100, score),
    reasons,
  };
}

export type MatchOutcome = {
  /** Tek ve yeterince güçlü bir aday varsa onun kimliği; yoksa null. */
  suggestedStudentId: string | null;
  candidates: MatchCandidate[];
};

// Otomatik öneri için gereken en düşük puan. Öğrenci numarası (60) tek
// başına yeter; yalnızca "ad ve soyad ayrı ayrı" (12) yetmez.
const SUGGEST_THRESHOLD = 35;

export function matchBankRow(
  students: MatchableStudent[],
  description: string,
  amount: number
): MatchOutcome {
  const candidates = students
    .map((s) => scoreStudent(s, description, amount))
    .filter((c): c is MatchCandidate => c !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (candidates.length === 0) return { suggestedStudentId: null, candidates: [] };

  const best = candidates[0];
  const runnerUp = candidates[1];

  // ⚠️ BERABERLİKTE ÖNERİ YAPILMAZ.
  //
  // İki öğrenci aynı puanı alıyorsa (aynı isim, ya da ikisi de yalnızca
  // veli adıyla eşleşmiş) sistem birini seçemez. Yanlış öğrenciye para
  // yazmak, hiç yazmamaktan çok daha pahalıdır — sekreter seçsin.
  const belirsiz = runnerUp !== undefined && runnerUp.score === best.score;

  return {
    suggestedStudentId: !belirsiz && best.score >= SUGGEST_THRESHOLD ? best.studentId : null,
    candidates,
  };
}
