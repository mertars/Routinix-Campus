import { CURRICULUM_TREE, XRAY_MIN_GRADE } from "@/lib/mock-data";

// CURRICULUM_TREE.Matematik'i worker'ın işleyeceği SIRALI listelere
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

// "alt_konu" variant'ı için — TEK bir alt konuyu kapsayan turlar (75 birim).
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

export type FlattenedTopic = {
  subject: string;
  grade: number;
  topicId: string;
  topicName: string;
  subtopics: { subtopicId: string; subtopicName: string }[];
};

// "genel" ve "yeterlilik" variant'ları için — TEMANIN TÜMÜNÜ (tüm alt
// konularını) kapsayan turlar (22 birim). Her ikisi de aynı birim
// kümesinde çalışır, sadece soru sayısı/zorluğu farklıdır (bkz. prompt.ts).
export function flattenTopics(subject: string): FlattenedTopic[] {
  const topics = CURRICULUM_TREE[subject] ?? [];
  return topics
    .filter((t) => t.grade >= XRAY_MIN_GRADE)
    .map((topic) => ({
      subject,
      grade: topic.grade,
      topicId: topic.id,
      topicName: topic.name,
      subtopics: topic.subtopics.map((sub) => ({ subtopicId: sub.id, subtopicName: sub.name })),
    }));
}
