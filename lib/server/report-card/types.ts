export type SubjectNetSummary = {
  subject: string;
  studentNet: number;
  classAverageNet: number;
  delta: number; // studentNet - classAverageNet
};

export type ReportCardAnalysis = {
  attendanceRate: number; // 0-100
  subjectSummaries: SubjectNetSummary[];
  guidanceNotes: string[];
};
