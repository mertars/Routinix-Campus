// Faz R — veli için sadeleştirilmiş özet: kazanımId/teknik detay yerine
// doğal dilde tek bir cümle ("Matematikte türev konusunda güçlü, integral
// konusunda desteğe ihtiyacı var" örneği kullanıcının kendi isteğinden).
// SAF fonksiyon — hem web (parent/xray-summary-card.tsx) hem gerekirse
// başka bir yüzeyde test edilebilir/yeniden kullanılabilir olsun diye
// bileşenden ayrı tutuldu.
export type NamedScore = { name: string; masteryScore: number | null };

export function generateParentSummary(subject: string, subtopics: NamedScore[]): string {
  const tested = subtopics.filter((s): s is { name: string; masteryScore: number } => s.masteryScore !== null);
  if (tested.length === 0) return `${subject} dersinde henüz röntgen testi tamamlanmadı.`;

  const strong = tested.filter((s) => s.masteryScore >= 60).sort((a, b) => b.masteryScore - a.masteryScore);
  const weak = tested.filter((s) => s.masteryScore < 30).sort((a, b) => a.masteryScore - b.masteryScore);

  const strongNames = strong.slice(0, 2).map((s) => s.name);
  const weakNames = weak.slice(0, 2).map((s) => s.name);

  if (strongNames.length > 0 && weakNames.length > 0) {
    return `${subject} dersinde ${strongNames.join(" ve ")} konu${strongNames.length > 1 ? "larında" : "sunda"} güçlü, ${weakNames.join(" ve ")} konu${weakNames.length > 1 ? "larında" : "sunda"} desteğe ihtiyacı var.`;
  }
  if (strongNames.length > 0) {
    return `${subject} dersinde test edilen konularda genel olarak güçlü — özellikle ${strongNames.join(" ve ")}.`;
  }
  if (weakNames.length > 0) {
    return `${subject} dersinde ${weakNames.join(" ve ")} konu${weakNames.length > 1 ? "larında" : "sunda"} desteğe ihtiyacı var, düzenli tekrar önerilir.`;
  }
  return `${subject} dersinde test edilen konularda orta seviyede — düzenli çalışmayla ilerleme sağlanabilir.`;
}
