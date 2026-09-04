import { CURRICULUM_TREE } from "@/lib/mock-data";

function normalize(text: string): string {
  return text.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

function tokenize(text: string): string[] {
  return text.split(/[^\p{L}0-9]+/u).filter((t) => t.length >= 3);
}

function sharedPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// Türkçe eklemeli bir dil — "Fonksiyonlar" (video konusu) ile "Fonksiyon
// Kavramı" (subtopic adı) gibi AYNI kökten ama farklı ek/kelime alan
// çiftler saf alt-dize eşleştirmesinden (biri diğerinin içinde geçmiyor)
// kaçar. Bunun için kelime bazlı bir ORTAK ÖNEK kontrolü de ekleniyor —
// gerçek bir gövdeleyici (stemmer) olmadan, "en az 5 harf ortak önek"
// heuristiği çoğu ek farkını (-lar, -ı, -si vb.) tolere ediyor.
function isRelated(needle: string, hay: string): boolean {
  if (hay.includes(needle) || needle.includes(hay)) return true;
  for (const nt of tokenize(needle)) {
    for (const ht of tokenize(hay)) {
      const shared = sharedPrefixLength(nt, ht);
      if (shared >= 5 || shared === Math.min(nt.length, ht.length)) return true;
    }
  }
  return false;
}

export type MatchedSubtopic = { subtopicId: string; name: string };

// Video Ders Merkezi — Röntgen entegrasyonu (2026-09-04). Video.topic
// yönetici tarafından serbest metin olarak girilir (örn. "Türev"),
// CURRICULUM_TREE'deki subtopic isimleriyle (örn. "Türev Kuralları",
// "Türev Uygulamaları") HER ZAMAN birebir eşleşmez. Bu yüzden esnek bir
// alt-dize eşleştirmesi yapıyoruz: video konusu bir subtopic adının
// İÇİNDE geçiyorsa (ya da tam tersi — admin tam subtopic adını yazdıysa),
// o subtopic'i "ilgili" sayıyoruz. Kısa/az anlamlı metinlerin (örn. tek
// harf) yanlış eşleşme üretmesini önlemek için minimum 3 karakter şartı
// var. Hiçbir subtopic eşleşmezse, konu adı doğrudan bir TOPIC (ders
// başlığı, örn. Fizik'teki "Kuvvet ve Hareket") ile eşleşiyor mu diye
// bakılıp o başlığın TÜM alt konuları döndürülür.
export function matchSubtopicsForVideoTopic(subject: string, videoTopic: string): MatchedSubtopic[] {
  const topics = CURRICULUM_TREE[subject];
  if (!topics) return [];
  const needle = normalize(videoTopic);
  if (needle.length < 3) return [];

  const direct: MatchedSubtopic[] = [];
  for (const topic of topics) {
    for (const sub of topic.subtopics) {
      if (isRelated(needle, normalize(sub.name))) direct.push({ subtopicId: sub.id, name: sub.name });
    }
  }
  if (direct.length > 0) return direct;

  for (const topic of topics) {
    if (isRelated(needle, normalize(topic.name))) {
      return topic.subtopics.map((sub) => ({ subtopicId: sub.id, name: sub.name }));
    }
  }
  return [];
}

// Röntgen sadece Matematik ve Fizik için gerçek alt konu kırılımına sahip
// (bkz. CURRICULUM_TREE) — diğer Video Ders Merkezi dersleri (Kimya,
// Tarih, İngilizce vb.) için hiçbir öneri üretilemez, UI bunu "desteklen-
// meyen ders" olarak ayırt edebilsin diye bu kontrol dışa açılıyor.
export function subjectHasCurriculumBreakdown(subject: string): boolean {
  return subject in CURRICULUM_TREE;
}
