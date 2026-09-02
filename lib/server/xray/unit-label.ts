import { flattenTopics, flattenCurriculum } from "./question-generation/curriculum-flatten";

// Faz Z16 — kullanıcı geri bildirimi: "genel" (30 soru, TEMANIN TÜMÜNÜ
// kapsar) testler yanlışlıkla TEK bir alt konuya göre atanıyordu — havuz
// sorgusu XrayPracticeQuestion.subtopicId'ye göre filtrelendiği için
// öğrenciye 30 yerine ~8 soru geliyordu (30 soru temanın TÜM alt
// konularına dağıldığı için, tek bir subtopicId'ye SADECE o payı düşüyor).
//
// Çözüm: "genel" atamalarında XrayPracticeAttempt.subtopicId
// alanı artık bir SUBTOPIC id'si değil, bir TOPIC (tema) id'si taşır —
// tıpkı soru üretim pipeline'ındaki XrayPoolGenerationRound.unitId'nin
// AYNI ikili anlamı taşıması gibi (variant'a göre topicId veya
// subtopicId). Alan adı geriye dönük uyumluluk için "subtopicId" olarak
// KALDI (şema/API sözleşmesini kırmamak için) — ama SEMANTİĞİ artık
// "unitId" (variant'a göre topicId ya da subtopicId). Bu dosya, bu ikili
// anlamı DOĞRU çözmek için TEK kaynak — hem okunabilir isim çözümü hem
// havuz sorgusu için gerekli subtopicId listesi burada toplanır.
export function resolveUnitLabel(subject: string, unitId: string, variant: string): string {
  if (variant === "yerlestirme") {
    // bkz. lib/server/xray/placement-pool.ts resolvePlacementScope — unitId
    // burada gerçek bir topicId/subtopicId DEĞİL, "yerlestirme:9" veya
    // "yerlestirme:9-12" gibi sentetik bir kapsam etiketidir.
    const scope = unitId.split(":")[1];
    return scope === "9-12" ? "Seviye Belirleme Sınavı (9-12. Sınıf)" : `Seviye Belirleme Sınavı (${scope}. Sınıf)`;
  }
  if (variant === "alt_konu") {
    return flattenCurriculum(subject).find((s) => s.subtopicId === unitId)?.subtopicName ?? unitId;
  }
  return flattenTopics(subject).find((t) => t.topicId === unitId)?.topicName ?? unitId;
}

// "genel" için verilen unitId'nin (topicId) KAPSADIĞI TÜM
// subtopicId'leri döner (havuz sorgusu bunların TAMAMINI çekmeli) —
// "alt_konu" için zaten unitId'nin kendisi tek bir subtopicId'dir.
export function resolveUnitSubtopicIds(subject: string, unitId: string, variant: string): string[] {
  if (variant === "alt_konu") return [unitId];
  return flattenTopics(subject).find((t) => t.topicId === unitId)?.subtopics.map((s) => s.subtopicId) ?? [];
}
