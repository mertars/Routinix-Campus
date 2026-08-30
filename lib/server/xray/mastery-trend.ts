// Faz J — TopicMasteryHistory'deki ham (studentId, subtopicId, masteryScore,
// assessedAt) satırlarını, yönetici/öğretmen analiz ekranındaki trend
// grafiklerinin doğrudan çizebileceği hazır yapılara dönüştüren SAF
// fonksiyonlar (DB'ye bağımlı değil — bkz. mastery-trend.test.ts benzeri
// hızlı doğrulama, practice-pool.ts'teki AYNI "önce saf fonksiyon, sonra
// endpoint" deseni).
export type HistoryRow = { subtopicId: string; masteryScore: number; assessedAt: Date };

export type OverallTrendPoint = { assessedAt: string; average: number; subtopicId: string; masteryScore: number };
export type SubtopicSeries = { subtopicId: string; points: { assessedAt: string; masteryScore: number }[] };
export type PeriodComparisonRow = { subtopicId: string; previousScore: number | null; currentScore: number; delta: number | null };
export type Heatmap = { months: string[]; rows: { subtopicId: string; valuesByMonth: (number | null)[] }[] };

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Kronolojik olarak ilerlerken her olaydan SONRA "o ana kadarki en güncel
// skorların ortalaması" anlık görüntüsünü (snapshot) üretir — genel
// ortalama trend çizgisi için. Farklı konular farklı zamanlarda test
// edildiğinden BASİT bir "tüm satırların ortalaması" YANLIŞ olur (aynı
// konunun eski VE yeni skoru aynı anda sayılmış olur) — bunun yerine her
// konunun SADECE o ana kadarki EN SON bilinen skoru katkı sağlar.
export function computeOverallTrend(history: HistoryRow[]): OverallTrendPoint[] {
  const sorted = [...history].sort((a, b) => a.assessedAt.getTime() - b.assessedAt.getTime());
  const latestBySubtopic = new Map<string, number>();
  const points: OverallTrendPoint[] = [];
  for (const row of sorted) {
    latestBySubtopic.set(row.subtopicId, row.masteryScore);
    const values = [...latestBySubtopic.values()];
    const average = Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
    points.push({ assessedAt: row.assessedAt.toISOString(), average, subtopicId: row.subtopicId, masteryScore: row.masteryScore });
  }
  return points;
}

// Konu bazlı çoklu-çizgi grafiği için ham seriler — sadece en az 1 kaydı
// olan konular döner (hiç test edilmemiş konu çizgi bile oluşturamaz).
export function computeSubtopicSeries(history: HistoryRow[]): SubtopicSeries[] {
  const bySubtopic = new Map<string, HistoryRow[]>();
  for (const row of history) {
    const list = bySubtopic.get(row.subtopicId) ?? [];
    list.push(row);
    bySubtopic.set(row.subtopicId, list);
  }
  return [...bySubtopic.entries()].map(([subtopicId, rows]) => ({
    subtopicId,
    points: [...rows]
      .sort((a, b) => a.assessedAt.getTime() - b.assessedAt.getTime())
      .map((r) => ({ assessedAt: r.assessedAt.toISOString(), masteryScore: r.masteryScore })),
  }));
}

// Dönemsel karşılaştırma çubuk grafiği: her konu için GÜNCEL skor (en son
// kayıt) ile ~30 gün ÖNCESİNDEKİ en son bilinen skor (o tarihten ÖNCEKİ en
// yakın kayıt — "30 gün önce tam o gün test edildi" varsayımı YANLIŞ
// olurdu, konular farklı günlerde test edilir) karşılaştırılır.
export function computePeriodComparison(history: HistoryRow[], now: Date = new Date()): PeriodComparisonRow[] {
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const bySubtopic = new Map<string, HistoryRow[]>();
  for (const row of history) {
    const list = bySubtopic.get(row.subtopicId) ?? [];
    list.push(row);
    bySubtopic.set(row.subtopicId, list);
  }
  const result: PeriodComparisonRow[] = [];
  for (const [subtopicId, rows] of bySubtopic) {
    const sorted = [...rows].sort((a, b) => a.assessedAt.getTime() - b.assessedAt.getTime());
    const current = sorted[sorted.length - 1];
    const beforeCutoff = sorted.filter((r) => r.assessedAt.getTime() <= cutoff.getTime());
    const previous = beforeCutoff.length > 0 ? beforeCutoff[beforeCutoff.length - 1] : null;
    result.push({
      subtopicId,
      previousScore: previous?.masteryScore ?? null,
      currentScore: current.masteryScore,
      delta: previous ? current.masteryScore - previous.masteryScore : null,
    });
  }
  return result;
}

// Isı haritası: sütunlar = ay (kronolojik, veride görülen en eski aydan
// bugüne kadar BOŞLUKSUZ), satırlar = konu. Bir konunun test edilmediği
// aylarda EN SON bilinen skor "ileri doldurulur" (forward-fill) — ustalık
// seviyesi yeni bir test yapılana kadar mantıken KORUNUR, o ayda test
// yapılmadı diye boş/sıfır göstermek yanıltıcı olurdu.
export function computeHeatmap(history: HistoryRow[], now: Date = new Date()): Heatmap {
  if (history.length === 0) return { months: [], rows: [] };
  const bySubtopic = new Map<string, HistoryRow[]>();
  for (const row of history) {
    const list = bySubtopic.get(row.subtopicId) ?? [];
    list.push(row);
    bySubtopic.set(row.subtopicId, list);
  }
  const earliest = history.reduce((min, r) => (r.assessedAt < min ? r.assessedAt : min), history[0].assessedAt);
  const months: string[] = [];
  const cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  while (cursor.getTime() <= end.getTime()) {
    months.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const rows = [...bySubtopic.entries()].map(([subtopicId, rawRows]) => {
    const sorted = [...rawRows].sort((a, b) => a.assessedAt.getTime() - b.assessedAt.getTime());
    let cursorIdx = 0;
    let lastKnown: number | null = null;
    const valuesByMonth = months.map((month) => {
      while (cursorIdx < sorted.length && monthKey(sorted[cursorIdx].assessedAt) <= month) {
        lastKnown = sorted[cursorIdx].masteryScore;
        cursorIdx++;
      }
      return lastKnown;
    });
    return { subtopicId, valuesByMonth };
  });

  return { months, rows };
}
