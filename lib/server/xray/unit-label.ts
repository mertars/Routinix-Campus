import { flattenTopics, flattenCurriculum } from "./question-generation/curriculum-flatten";

// Faz Z16 — kullanıcı geri bildirimi: "genel" (30 soru, TEMANIN TÜMÜNÜ
// kapsar) testler yanlışlıkla TEK bir alt konuya göre atanıyordu — havuz
// sorgusu XrayPracticeQuestion.subtopicId'ye göre filtrelendiği için
// öğrenciye 30 yerine ~8 soru geliyordu (30 soru temanın TÜM alt
// konularına dağıldığı için, tek bir subtopicId'ye SADECE o payı düşüyor).
//
// Çözüm: "genel"/"yeterlilik" atamalarında XrayPracticeAttempt.subtopicId
// alanı artık bir SUBTOPIC id'si değil, bir TOPIC (tema) id'si taşır —
// tıpkı soru üretim pipeline'ındaki XrayPoolGenerationRound.unitId'nin
// AYNI ikili anlamı taşıması gibi (variant'a göre topicId veya
// subtopicId). Alan adı geriye dönük uyumluluk için "subtopicId" olarak
// KALDI (şema/API sözleşmesini kırmamak için) — ama SEMANTİĞİ artık
// "unitId" (variant'a göre topicId ya da subtopicId). Bu dosya, bu ikili
// anlamı DOĞRU çözmek için TEK kaynak — hem okunabilir isim çözümü hem
// havuz sorgusu için gerekli subtopicId listesi burada toplanır.
export function resolveUnitLabel(subject: string, unitId: string, variant: string): string {
  if (variant === "alt_konu") {
    return flattenCurriculum(subject).find((s) => s.subtopicId === unitId)?.subtopicName ?? unitId;
  }
  return flattenTopics(subject).find((t) => t.topicId === unitId)?.topicName ?? unitId;
}

// "genel"/"yeterlilik" için verilen unitId'nin (topicId) KAPSADIĞI TÜM
// subtopicId'leri döner (havuz sorgusu bunların TAMAMINI çekmeli) —
// "alt_konu" için zaten unitId'nin kendisi tek bir subtopicId'dir.
export function resolveUnitSubtopicIds(subject: string, unitId: string, variant: string): string[] {
  if (variant === "alt_konu") return [unitId];
  return flattenTopics(subject).find((t) => t.topicId === unitId)?.subtopics.map((s) => s.subtopicId) ?? [];
}
