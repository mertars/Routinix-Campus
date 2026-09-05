// Ölçme Değerlendirme modülünün paylaşılan tipleri (2026-09-05 yeniden
// yazımı). Tek yerde toplandı — önceki sürümde aynı şekiller 4-5 ayrı
// bileşende birbirinden hafifçe farklı kopyalarla tekrar tanımlanıyordu,
// bu da bir uç değiştiğinde sessizce uyumsuz kalan bileşenlere yol
// açıyordu.

export type ExamListItem = {
  id: string;
  name: string;
  examDate: string;
  opticalFormatId: string | null;
  subjectCount: number;
  answerKeySubjectCount: number;
  studentCount: number;
};

export type OverviewSubject = {
  subject: string;
  // Şablondaki sütun uzunluğu = o dersin soru sayısı. Şablonsuz (eski)
  // denemelerde null olabilir — o zaman kullanıcı soru sayısını cevap
  // anahtarı metninin uzunluğuyla kendisi belirler.
  expectedQuestionCount: number | null;
  questionCount: number;
  answeredCount: number;
  resultCount: number;
  supportsRoentgenBridge: boolean;
};

export type ExamOverview = {
  exam: { id: string; name: string; examDate: string; opticalFormatId: string | null };
  format: { id: string; name: string; subjectBlocks: { subject: string; start: number; length: number }[] } | null;
  subjects: OverviewSubject[];
  studentCount: number;
};

export type SubjectScore = { subject: string; correct: number; wrong: number; blank: number; net: number };

export type ResultStudent = {
  studentId: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
  branchName: string;
  totalNet: number;
  rank: number;
  branchRank: number;
  subjects: (SubjectScore | null)[];
};

export type ExamResults = {
  exam: { id: string; name: string; examDate: string };
  subjects: string[];
  subjectStats: { subject: string; questionCount: number; averageNet: number }[];
  stats: { studentCount: number; subjectCount: number; averageNet: number; highestNet: number; lowestNet: number };
  students: ResultStudent[];
};

export function formatExamDate(value: string): string {
  return new Date(value).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}
