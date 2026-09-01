import { flattenTopics } from "./question-generation/curriculum-flatten";
import { pickRandomTestFromPool, capSelection, type PoolQuestion, type SelectedQuestion } from "./practice-pool";

// Faz Q — "Seviye Belirleme Sınavı": dershaneye gelen HER öğrenciye,
// sınıf seviyesine göre kapsamlı bir ilk tanı testi verilir. 9/10/11.
// sınıflar SADECE kendi sınıf müfredatını, 12. sınıf VE mezunlar 9-12'nin
// TAMAMINI kapsar (YKS'nin kümülatif doğası gereği). Mevcut "genel" havuz
// testi (30 soru/TEK tema) TEK bir topicId'ye bağlıyken, bu test BİRDEN
// FAZLA temayı BİRLEŞTİRİR — bu yüzden ayrı bir modül.
export type PlacementScope = { topicIds: string[]; label: string };

// Her tema başına çekilecek soru sayısı — "genel" havuzunun 30 sorusundan
// (TEK tema) çok daha az, çünkü BİRDEN FAZLA tema birleştiriliyor. 9/10/11
// için tema sayısı azken (3-7) daha yüksek bir oran uygulanabilir; 12/mezun
// TÜM 22 temayı kapsadığı için daha düşük tutulur — aksi halde test 80+
// soruya çıkar. İkisi de kolayca ayarlanabilir sabitler.
const QUESTIONS_PER_TOPIC_SINGLE_GRADE = 4;
const QUESTIONS_PER_TOPIC_FULL_SPAN = 2;

export function resolvePlacementScope(subject: string, grade: number, segment: string): PlacementScope {
  const allTopics = flattenTopics(subject);
  if (grade >= 12 || segment === "MEZUN") {
    return { topicIds: allTopics.map((t) => t.topicId), label: "yerlestirme:9-12" };
  }
  const scoped = allTopics.filter((t) => t.grade === grade);
  return { topicIds: scoped.map((t) => t.topicId), label: `yerlestirme:${grade}` };
}

// Her temanın kendi havuzundan (pickRandomTestFromPool ile kazanım-
// çeşitliliği korunarak) bir alt küme çekip BİRLEŞTİRİR. Temalar arası
// çakışan `order` numaralarını (her tema kendi içinde 1-30 numaralandığı
// için) 1..N olacak şekilde YENİDEN sıralar — aksi halde birleştirilince
// aynı order'lı sorular çakışır.
export async function buildPlacementQuestionSet(
  findPool: (topicId: string) => Promise<PoolQuestion[]>,
  topicIds: string[]
): Promise<SelectedQuestion[]> {
  const perTopicCount = topicIds.length <= 8 ? QUESTIONS_PER_TOPIC_SINGLE_GRADE : QUESTIONS_PER_TOPIC_FULL_SPAN;
  const merged: SelectedQuestion[] = [];
  for (const topicId of topicIds) {
    const pool = await findPool(topicId);
    if (pool.length === 0) continue;
    const full = pickRandomTestFromPool(pool);
    merged.push(...capSelection(full, perTopicCount));
  }
  return merged.map((q, index) => ({ id: q.id, order: index + 1 }));
}
