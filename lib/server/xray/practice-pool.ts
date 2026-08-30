// Akademik Röntgen — Test 1 havuz motoru (Faz G). Kullanıcı aynı konu için
// onlarca ayrı test yükleyecek (örn. 10 test × 30 soru = 300 sorulu bir
// HAVUZ, her biri bir kazanımId'ye etiketli). Öğrenci artık belirli bir
// testId SEÇMİYOR — her "Teste Başla" tıklamasında bu fonksiyon havuzdan
// RASTGELE bir 30 soruluk test derler, böylece aynı konu tekrar tekrar
// çalışılsa bile her seferinde farklı somut sorularla karşılaşılır.
//
// ⚠️ Grupla kritik nokta: BİR yüklemenin İÇİNDE aynı kazanımId BİRDEN
// FAZLA kez geçebilir (örn. "KUVVET_KURALI" 4 farklı zorlukta sorulur,
// bkz. gerçek örnek: soruNo 7-10). Sadece kazanimId'ye göre gruplarsak bu
// 4 soru TEK bir soruya çöker (30 soruluk test 13 soruya düşer) — YANLIŞ.
// Doğrusu: HER yüklemenin kendi İÇİNDE aynı kazanımın kaçıncı YİNELENMESİ
// olduğunu (occurrence) hesaplayıp, farklı yüklemelerden gelen AYNI
// (kazanımId, occurrence) çiftini eşleştirmek — böylece "KUVVET_KURALI'nın
// 1. sorusu" havuzdaki TÜM yüklemelerin 1. KUVVET_KURALI sorusundan
// rastgele seçilir, zorluk ilerlemesi (occurrence sırası) korunur.
export type PoolQuestion = { id: string; kazanimId: string; order: number; testId: string };
export type SelectedQuestion = { id: string; order: number };

export function pickRandomTestFromPool(pool: PoolQuestion[]): SelectedQuestion[] {
  const byTest = new Map<string, PoolQuestion[]>();
  for (const q of pool) {
    const list = byTest.get(q.testId) ?? [];
    list.push(q);
    byTest.set(q.testId, list);
  }

  const byGroupKey = new Map<string, PoolQuestion[]>();
  for (const questions of byTest.values()) {
    const sorted = [...questions].sort((a, b) => a.order - b.order);
    const occurrenceByKazanim = new Map<string, number>();
    for (const q of sorted) {
      const occurrence = (occurrenceByKazanim.get(q.kazanimId) ?? 0) + 1;
      occurrenceByKazanim.set(q.kazanimId, occurrence);
      const groupKey = `${q.kazanimId}::${occurrence}`;
      const list = byGroupKey.get(groupKey) ?? [];
      list.push(q);
      byGroupKey.set(groupKey, list);
    }
  }

  const selected: SelectedQuestion[] = [];
  for (const candidates of byGroupKey.values()) {
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    // Gösterim sırası: bu grubun havuzdaki EN KÜÇÜK soruNo'su — hangi
    // somut varyant çekilirse çekilsin, "giriş/özel durum/4 işlem" akışı
    // (bkz. kullanıcının 1-10/10-20/20-30 katman açıklaması) korunur.
    const displayOrder = Math.min(...candidates.map((c) => c.order));
    selected.push({ id: pick.id, order: displayOrder });
  }

  return selected.sort((a, b) => a.order - b.order);
}

// Faz N — aylık tarama testi TAM havuz testi değil, SABİT bir üst sınırla
// (bkz. MONTHLY_SCREENING_QUESTION_COUNT) sınırlı, hızlı bir "unutma
// riski" kontrolü. pickRandomTestFromPool'un kazanım-çeşitliliği koruyan
// tam seçimi ÜZERİNE, gerekirse RASTGELE bir alt küme alınır (Fisher-Yates
// kısmi karıştırma) — havuz zaten üst sınırdan küçükse dokunulmadan döner.
export function capSelection(selection: SelectedQuestion[], max: number): SelectedQuestion[] {
  if (selection.length <= max) return selection;
  const shuffled = [...selection];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, max).sort((a, b) => a.order - b.order);
}
