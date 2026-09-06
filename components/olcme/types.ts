// Ölçme Değerlendirme modülünün paylaşılan tipleri. Tek yerde toplandı —
// aynı şekillerin bileşen bileşen kopyalanması, bir uç değiştiğinde
// sessizce uyumsuz kalan bileşenlere yol açıyordu.

export type ExamCategoryKind = "STANDARD" | "YKS_PAIR";

export type ExamCategory = {
  id: string;
  name: string;
  kind: ExamCategoryKind;
  sortOrder: number;
  examCount: number;
};

export type ExamListItem = {
  id: string;
  name: string;
  examDate: string;
  opticalFormatId: string | null;
  categoryId: string | null;
  category: { id: string; name: string; kind: ExamCategoryKind } | null;
  groupId: string | null;
  subjectCount: number;
  answerKeySubjectCount: number;
  studentCount: number;
};

export type ExamGroupItem = {
  id: string;
  name: string;
  examDate: string;
  studentCount: number;
  exams: { id: string; name: string; examDate: string; categoryName: string | null }[];
};

export type OverviewSubject = {
  subject: string;
  expectedQuestionCount: number | null;
  questionCount: number;
  answeredCount: number;
  resultCount: number;
  supportsRoentgenBridge: boolean;
};

export type ExamOverview = {
  exam: { id: string; name: string; examDate: string; opticalFormatId: string | null; categoryId: string | null; categoryName: string | null };
  format: { id: string; name: string; subjectBlocks: { subject: string; start: number; length: number }[] } | null;
  subjects: OverviewSubject[];
  studentCount: number;
};

export type SubjectScore = { subject: string; correct: number; wrong: number; blank: number; net: number };

export type TrackResult = { track: string; net: number; rank: number | null } | null;

export type ResultStudent = {
  studentId: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
  branchName: string;
  grade: number;
  track: string | null;
  totalNet: number;
  rank: number;
  branchRank: number;
  gradeRank: number;
  subjects: (SubjectScore | null)[];
  trackResult: TrackResult;
};

export type TrackRanking = {
  track: string;
  subjects: string[];
  students: { studentId: string; firstName: string; lastName: string; branchName: string; trackNet: number; rank: number }[];
};

export type ExamResults = {
  exam: { id: string; name: string; examDate: string };
  subjects: string[];
  subjectStats: { subject: string; questionCount: number; averageNet: number }[];
  stats: { studentCount: number; subjectCount: number; averageNet: number; highestNet: number; lowestNet: number };
  students: ResultStudent[];
  trackRankings: TrackRanking[];
};

// ---------- Analiz ----------

export type AnalyticsTrendPoint = { sessionId: string; name: string; date: string; averageNet: number; studentCount: number };

export type AnalyticsStudent = {
  studentId: string;
  firstName: string;
  lastName: string;
  branchId: string;
  branchName: string;
  grade: number;
  examCount: number;
  latestNet: number;
  averageNet: number;
  bestNet: number;
  delta: number | null;
  history: number[];
};

export type OlcmeAnalytics = {
  categories: { id: string; name: string; kind: ExamCategoryKind }[];
  grades: number[];
  branches: { branchId: string; branchName: string; grade: number; studentCount: number; averageNet: number }[];
  gradeBreakdown: { grade: number; studentCount: number; averageNet: number }[];
  summary: { sessionCount: number; studentCount: number; averageNet: number; latestName: string | null; netChange: number | null };
  trend: AnalyticsTrendPoint[];
  subjectAverages: { subject: string; averageNet: number; resultCount: number }[];
  students: AnalyticsStudent[];
  weakSubtopics: { subtopicLabel: string; averagePercent: number; studentCount: number }[];
};

export type StudentAnalytics = {
  student: { id: string; firstName: string; lastName: string; studentNumber: string; branchName: string; grade: number };
  sessions: {
    sessionId: string;
    name: string;
    date: string;
    totalNet: number;
    rank: number | null;
    participantCount: number;
    subjects: SubjectScore[];
  }[];
  subjectAverages: { subject: string; averageNet: number; examCount: number }[];
  weakSubtopics: { subtopicLabel: string; percent: number; questionCount: number }[];
};

export function formatExamDate(value: string): string {
  return new Date(value).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

export function gradeLabel(grade: number): string {
  return `${grade}. Sınıf`;
}
