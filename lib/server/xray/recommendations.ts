// Akademik Röntgen — kural bazlı reçete motoru. "Matematik Röntgeni"
// ürününün araştırılan ikinci temel özelliği: sadece TEŞHİS değil, tespit
// edilen eksikliğe yönelik somut bir ÇALIŞMA ÖNERİSİ de üretiliyor (bkz.
// lib/server/report-card/analyzer.ts'teki AYNI "kural bazlı otomatik metin"
// deseni — burada girdi net/devam değil, konu bazlı ustalık skoru).

export type SubtopicDiagnosis = { subtopicId: string; name: string; masteryScore: number };
export type Severity = "critical" | "moderate" | "strong";

export type XrayRecommendation = { subtopicId: string; name: string; masteryScore: number; severity: Severity; advice: string };

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

// Test edilmiş (masteryScore dolu) alt konulardan, EN ZAYIFTAN başlayarak
// sıralı bir öncelikli çalışma listesi üretir — gerçek üründeki "kişiye
// özel çalışma dokümanı" fikrinin metin karşılığı.
export function generateXrayRecommendations(subtopics: SubtopicDiagnosis[]): XrayRecommendation[] {
  return [...subtopics]
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .map((s) => {
      const severity = severityOf(s.masteryScore);
      return { subtopicId: s.subtopicId, name: s.name, masteryScore: s.masteryScore, severity, advice: adviceFor(s.name, severity) };
    });
}

export type XraySummary = {
  averageScore: number;
  criticalCount: number;
  moderateCount: number;
  strongCount: number;
  overallAdvice: string;
};

export function summarizeXrayDiagnosis(recommendations: XrayRecommendation[]): XraySummary {
  const criticalCount = recommendations.filter((r) => r.severity === "critical").length;
  const moderateCount = recommendations.filter((r) => r.severity === "moderate").length;
  const strongCount = recommendations.filter((r) => r.severity === "strong").length;
  const averageScore =
    recommendations.length === 0 ? 0 : Math.round(recommendations.reduce((sum, r) => sum + r.masteryScore, 0) / recommendations.length);

  let overallAdvice: string;
  if (recommendations.length === 0) {
    overallAdvice = "Henüz hiç konu test edilmedi.";
  } else if (criticalCount === 0 && moderateCount === 0) {
    overallAdvice = "Test edilen tüm konularda güçlü bir seviye tespit edildi. Düzenli tekrarla bu seviye korunmalı.";
  } else if (criticalCount > 0) {
    overallAdvice = `${criticalCount} konuda temelden eksik tespit edildi — çalışma programı öncelikle bu konulara odaklanmalı.`;
  } else {
    overallAdvice = `Kritik bir eksik yok, ancak ${moderateCount} konuda pekiştirme gerekiyor.`;
  }

  return { averageScore, criticalCount, moderateCount, strongCount, overallAdvice };
}
