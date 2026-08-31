// Faz X — Akademik Röntgen Test 1 soru havuzu içe aktarma sihirbazının
// (bkz. components/platform/xray-question-pool-wizard.tsx) paylaşılan
// tipleri — lib/bulk-import/types.ts'teki ÖĞRENCİ/ÖĞRETMEN sihirbazının
// AYNI deseni: RawRow -> RawQuestion, ValidatedRow -> ValidatedQuestion.
export type RawQuestion = {
  soruNo?: number;
  kazanimId?: string;
  questionText?: string;
  finalAnswer?: string;
  detailedSolution?: string;
  diagnosticComment?: string;
};

export type ValidatedQuestion = {
  rowIndex: number;
  raw: RawQuestion;
  label: string;
  isValid: boolean;
  errors: string[];
};
