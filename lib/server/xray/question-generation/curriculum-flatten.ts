import { CURRICULUM_TREE, XRAY_MIN_GRADE } from "@/lib/mock-data";

// CURRICULUM_TREE.Matematik'i worker'ın işleyeceği SIRALI alt konu listesine
// düzleştirir — dizinin kendi sırası (grade 9→12, tema tema) zaten master
// prompt'taki müfredat akışıyla birebir aynı (bkz. lib/mock-data.ts, Faz Z2
// yorumu), bu yüzden ekstra bir sıralama kuralı gerekmiyor: TEK doğru kaynak.
export type FlattenedSubtopic = {
  subject: string;
  grade: number;
  topicId: string;
  topicName: string;
  subtopicId: string;
  subtopicName: string;
};

export function flattenCurriculum(subject: string): FlattenedSubtopic[] {
  const topics = CURRICULUM_TREE[subject] ?? [];
  return topics
    .filter((t) => t.grade >= XRAY_MIN_GRADE)
    .flatMap((topic) =>
      topic.subtopics.map((sub) => ({
        subject,
        grade: topic.grade,
        topicId: topic.id,
        topicName: topic.name,
        subtopicId: sub.id,
        subtopicName: sub.name,
      })),
    );
}
