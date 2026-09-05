// Optik (OMR tarayıcı) sabit-genişlikli metin dosyası ayrıştırma + puanlama.
// Gerçek piyasa optik tarayıcıları bir GÖRÜNTÜ değil, her satırı bir öğrenci
// olan sabit-genişlikli bir .txt üretir — kimlik alanları (T.C./ad-soyad/
// şube) sabit karakter aralıklarında, sonra ders başına işaretlenen şıkların
// (A-E, boşsa boşluk/0/-) tek harflik dizisi. Format tarayıcı/kurum bazında
// değiştiği için (bkz. OpticalFormat) sütun aralıkları kullanıcı tarafından
// tanımlanır — burada YAPILAN, o tanıma göre GENEL bir dilimleme, tek bir
// tarayıcı markasına özel sabit kodlama DEĞİL.

export type OpticalFieldDef = { start: number; length: number };

export type OpticalFormatDef = {
  tcNo?: OpticalFieldDef | null;
  studentNo?: OpticalFieldDef | null;
  booklet?: OpticalFieldDef | null;
  grade?: OpticalFieldDef | null;
  branch?: OpticalFieldDef | null;
  name?: OpticalFieldDef | null;
};

export type ParsedOpticalRow = {
  lineNumber: number;
  tcNo: string | null;
  studentNo: string | null;
  booklet: string | null;
  grade: string | null;
  branch: string | null;
  name: string | null;
  rawAnswers: string;
};

// Kullanıcının ekran görüntüsündeki "Başlangıç" alanı 1-tabanlıdır (ilk
// karakter = 1) — edesis'in kendi ekranıyla AYNI kural, kafa karışıklığı
// olmasın diye.
function sliceField(line: string, field?: OpticalFieldDef | null): string | null {
  if (!field || field.start < 1 || field.length < 1) return null;
  const value = line.slice(field.start - 1, field.start - 1 + field.length).trim();
  return value.length > 0 ? value : null;
}

export function parseOpticalText(rawText: string, format: OpticalFormatDef, subjectField: OpticalFieldDef): ParsedOpticalRow[] {
  const lines = rawText.split(/\r?\n/);
  const rows: ParsedOpticalRow[] = [];
  lines.forEach((line, i) => {
    if (line.trim().length === 0) return;
    rows.push({
      lineNumber: i + 1,
      tcNo: sliceField(line, format.tcNo),
      studentNo: sliceField(line, format.studentNo),
      booklet: sliceField(line, format.booklet),
      grade: sliceField(line, format.grade),
      branch: sliceField(line, format.branch),
      name: sliceField(line, format.name),
      rawAnswers: line.slice(subjectField.start - 1, subjectField.start - 1 + subjectField.length),
    });
  });
  return rows;
}

const BLANK_MARKERS = new Set(["", "0", "-", "9", "X"]);

export type OpticalScoreResult = {
  wrongQuestionNumbers: number[];
  blankQuestionNumbers: number[];
  correctCount: number;
  net: number;
};

// Öğrencinin rawAnswers dizisini (her karakter = o soru numarasındaki
// işaretlediği şık) sorunun questionNumber'daki correctAnswer'ıyla
// pozisyon pozisyon karşılaştırır. `questions` her zaman questionNumber'a
// göre artan sıralı VERİLMELİDİR (çağıran taraf — bkz. optical-upload
// route) ama emniyet için burada da questionNumber ile indekslenir,
// dizideki SIRAYA güvenilmez.
export function scoreOpticalAnswers(
  rawAnswers: string,
  questions: { questionNumber: number; correctAnswer: string | null }[]
): OpticalScoreResult {
  const wrongQuestionNumbers: number[] = [];
  const blankQuestionNumbers: number[] = [];
  let correctCount = 0;
  let scorable = 0;

  for (const q of questions) {
    const given = (rawAnswers[q.questionNumber - 1] ?? "").toUpperCase().trim();
    if (BLANK_MARKERS.has(given)) {
      blankQuestionNumbers.push(q.questionNumber);
      continue;
    }
    if (!q.correctAnswer) continue; // bu soru için henüz doğru cevap girilmemiş — puanlanamaz, atla
    scorable++;
    if (given === q.correctAnswer.toUpperCase().trim()) correctCount++;
    else wrongQuestionNumbers.push(q.questionNumber);
  }

  const net = Math.round((correctCount - wrongQuestionNumbers.length / 4) * 100) / 100;
  return { wrongQuestionNumbers, blankQuestionNumbers, correctCount, net };
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleUpperCase("tr");
}

export type OpticalRosterStudent = { id: string; firstName: string; lastName: string; nationalId: string; studentNumber: string };

// PDF sihirbazındaki matchRowToStudent (bkz. lib/exam-import/matching.ts)
// ile AYNI öncelik: T.C./Öğrenci No tam eşleşme > Ad Soyad tam eşleşme.
// Optik satırları zaten YAPISAL (ayrı tcNo/name alanları) olduğundan, o
// dosyadaki genel hücre-tabanlı eşleştiriciyi burada TEKRAR KULLANMAK yerine
// (kolon rolü kurgusu gerektirir, gereksiz dolaylama) doğrudan bir eşdeğerini
// yazıyoruz.
export function matchOpticalRow(
  row: ParsedOpticalRow,
  roster: OpticalRosterStudent[]
): { studentId: string | null; status: "matched" | "ambiguous" | "unmatched"; candidates: OpticalRosterStudent[] } {
  const tcNo = row.tcNo ? normalizeDigits(row.tcNo) : "";
  if (tcNo) {
    const byId = roster.filter((s) => s.nationalId === tcNo || s.studentNumber === row.tcNo?.trim());
    if (byId.length === 1) return { studentId: byId[0].id, status: "matched", candidates: byId };
    if (byId.length > 1) return { studentId: null, status: "ambiguous", candidates: byId };
  }

  const studentNo = row.studentNo?.trim();
  if (studentNo) {
    const byNo = roster.filter((s) => s.studentNumber === studentNo);
    if (byNo.length === 1) return { studentId: byNo[0].id, status: "matched", candidates: byNo };
    if (byNo.length > 1) return { studentId: null, status: "ambiguous", candidates: byNo };
  }

  if (row.name) {
    const rawName = normalizeName(row.name);
    const candidates = roster.filter((s) => normalizeName(`${s.firstName} ${s.lastName}`) === rawName);
    if (candidates.length === 1) return { studentId: candidates[0].id, status: "matched", candidates };
    if (candidates.length > 1) return { studentId: null, status: "ambiguous", candidates };
  }

  return { studentId: null, status: "unmatched", candidates: [] };
}
