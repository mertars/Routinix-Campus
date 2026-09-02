// Akademik Röntgen — kural bazlı reçete motoru. "Matematik Röntgeni"
// ürününün araştırılan ikinci temel özelliği: sadece TEŞHİS değil, tespit
// edilen eksikliğe yönelik somut bir ÇALIŞMA ÖNERİSİ de üretiliyor (bkz.
// lib/server/report-card/analyzer.ts'teki AYNI "kural bazlı otomatik metin"
// deseni — burada girdi net/devam değil, konu bazlı ustalık skoru).

export type SubtopicDiagnosis = { subtopicId: string; name: string; masteryScore: number };
export type Severity = "critical" | "moderate" | "strong";

// Faz Q — kullanıcı talebi: aynı teşhis verisi, İKİ FARKLI anlatım
// katmanında sunulmalı. `advice` — resmi, yönetici ekranı ve PDF'ler için
// (ASLA "merhaba" gibi bir hitap içermez, üçüncü şahıs/nesnel dil).
// `studioNote` — "Stüdyo Notu" (öğrenciye BİRİNCİ AĞIZDAN, samimi/sohbet
// dilinde, SADECE öğrenci ekranında kullanılır). İkisi AYNI severity'den
// üretilir, veri KAYNAĞI tek — sadece kelime seçimi/hitap değişir.
export type XrayRecommendation = { subtopicId: string; name: string; masteryScore: number; severity: Severity; advice: string; studioNote: string };

function severityOf(score: number): Severity {
  if (score < 30) return "critical";
  if (score < 60) return "moderate";
  return "strong";
}

function adviceFor(name: string, severity: Severity): string {
  if (severity === "critical") return `${name} konusunda temelden bir eksiklik tespit edildi — en kısa sürede sıfırdan tekrar edilmesi önerilir.`;
  if (severity === "moderate") return `${name} konusunda orta düzeyde bir bilgi var — pekiştirici soru çözümüyle desteklenmesi faydalı olur.`;
  return `${name} konusunda iyi bir seviyede — düzenli tekrarla bu seviye korunabilir.`;
}

function studioNoteFor(name: string, severity: Severity): string {
  if (severity === "critical") return `${name} konusunda temelden bir eksik var gibi görünüyor — hiç sorun değil, sıfırdan başlayıp beraber kapatırız. Bu hafta biraz zaman ayırmaya ne dersin?`;
  if (severity === "moderate") return `${name} konusunu orta düzeyde biliyorsun — birkaç pekiştirme sorusuyla bu iyice oturur.`;
  return `${name} konusunda gayet iyisin, böyle devam! Ara sıra tekrar etmen yeterli.`;
}

// Test edilmiş (masteryScore dolu) alt konulardan, EN ZAYIFTAN başlayarak
// sıralı bir öncelikli çalışma listesi üretir — gerçek üründeki "kişiye
// özel çalışma dokümanı" fikrinin metin karşılığı.
export function generateXrayRecommendations(subtopics: SubtopicDiagnosis[]): XrayRecommendation[] {
  return [...subtopics]
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .map((s) => {
      const severity = severityOf(s.masteryScore);
      return { subtopicId: s.subtopicId, name: s.name, masteryScore: s.masteryScore, severity, advice: adviceFor(s.name, severity), studioNote: studioNoteFor(s.name, severity) };
    });
}

export type XraySummary = {
  averageScore: number;
  criticalCount: number;
  moderateCount: number;
  strongCount: number;
  overallAdvice: string;
  studioSummary: string;
};

export function summarizeXrayDiagnosis(recommendations: XrayRecommendation[]): XraySummary {
  const criticalCount = recommendations.filter((r) => r.severity === "critical").length;
  const moderateCount = recommendations.filter((r) => r.severity === "moderate").length;
  const strongCount = recommendations.filter((r) => r.severity === "strong").length;
  const averageScore =
    recommendations.length === 0 ? 0 : Math.round(recommendations.reduce((sum, r) => sum + r.masteryScore, 0) / recommendations.length);

  let overallAdvice: string;
  let studioSummary: string;
  if (recommendations.length === 0) {
    overallAdvice = "Henüz hiç konu test edilmedi.";
    studioSummary = "Henüz hiç test çözmedin — ilk testini tamamladığında burada sana özel bir değerlendirme göreceksin.";
  } else if (criticalCount === 0 && moderateCount === 0) {
    overallAdvice = "Test edilen tüm konularda güçlü bir seviye tespit edildi. Düzenli tekrarla bu seviye korunmalı.";
    studioSummary = "Harika gidiyorsun! Test ettiğin tüm konularda güçlüsün — düzenli tekrarla bu seviyeyi koru.";
  } else if (criticalCount > 0) {
    overallAdvice = `${criticalCount} konuda temelden eksik tespit edildi — çalışma programı öncelikle bu konulara odaklanmalı.`;
    studioSummary = `${criticalCount} konuda temelden bir eksiğin var ama endişelenme — aşağıdaki listeden başlayarak adım adım kapatabiliriz.`;
  } else {
    overallAdvice = `Kritik bir eksik yok, ancak ${moderateCount} konuda pekiştirme gerekiyor.`;
    studioSummary = `Kritik bir eksiğin yok, gayet iyi durumdasın — ${moderateCount} konuda biraz pekiştirme yeterli olacaktır.`;
  }

  return { averageScore, criticalCount, moderateCount, strongCount, overallAdvice, studioSummary };
}
