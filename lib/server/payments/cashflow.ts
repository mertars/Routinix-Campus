// Nakit akışı projeksiyonu.
//
// Paneldeki TÜM raporlar geriye bakıyordu (trend, yaşlandırma, dağılım).
// Oysa bir dershane müdürünün en varoluşsal sorusu ileriye dönüktür:
// "önümüzdeki ay maaşları ve kirayı ödeyebilecek miyim?"
//
// Hesap DB'den ayrıştırılmıştır (saf fonksiyon) — böylece varsayımlar
// birim testlerle sabitlenebilir; rakam bir kez kaydığında bunu fark
// etmenin başka yolu yok.

const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export type CashflowInput = {
  /** Projeksiyonun başladığı andaki toplam kasa+banka bakiyesi. */
  openingBalance: number;
  /** İlk projeksiyon ayı (gün/saat yok sayılır, ayın 1'i kabul edilir). */
  startMonth: Date;
  monthCount: number;
  /** 0..1 — geçmiş tahsilat performansı. Bkz. computeCollectionRate. */
  collectionRate: number;
  /** Vadesi projeksiyon aralığında olan AÇIK taksitlerin kalan tutarları. */
  openInstallments: { dueDate: Date; remaining: number }[];
  /** Girilmiş ama ödenmemiş giderler (vadesi olanlar). */
  pendingExpenses: { dueDate: Date; amount: number; categoryId: string }[];
  /**
   * Kategori başına aylık beklenen gider. Kira/elektrik gibi düzenli
   * giderler için geçmiş ortalamadan, personel maaşı için bordro
   * taslağından türetilir.
   */
  recurringByCategory: { categoryId: string; categoryName: string; monthlyAmount: number }[];
  /**
   * İÇİNDE BULUNULAN ayda kategori bazında ZATEN ÖDENMİŞ tutarlar.
   *
   * openingBalance güncel bakiyedir, yani bu ay ödenmiş giderler ondan
   * ÇOKTAN düşmüştür. Düzenli gider tahmini ilk aya tam olarak
   * uygulanırsa aynı kira iki kez sayılır. Bu yüzden yalnızca İLK ayda
   * tahminden ödenmiş kısım çıkarılır.
   */
  alreadyPaidByCategory: { categoryId: string; amount: number }[];
};

export type CashflowMonth = {
  key: string;
  label: string;
  opening: number;
  /** Vadesi o ay dolan açık taksitlerin ham toplamı. */
  plannedIncome: number;
  /** plannedIncome × collectionRate — gerçekçi beklenti. */
  expectedIncome: number;
  /** O ay için GİRİLMİŞ (bilinen) gider toplamı. */
  knownExpense: number;
  /** Bilinen giderlerin üstüne düzenli gider tahmininden eklenen fark. */
  estimatedExpense: number;
  expectedExpense: number;
  closing: number;
  isNegative: boolean;
};

export type CashflowProjection = {
  months: CashflowMonth[];
  /** Kapanışın eksiye düştüğü İLK ay (yoksa null) — asıl uyarı bu. */
  firstNegativeMonth: string | null;
  lowestClosing: number;
};

/**
 * Aylık gider beklentisi kategori bazında `max(bilinen, düzenli tahmin)`
 * kuralıyla bulunur.
 *
 * Gerekçe: müdür Eylül elektrik faturasını sisteme girdiyse o ay için
 * DOĞRU rakam odur; girmediyse geçmiş ortalama en iyi tahmindir. İkisini
 * TOPLAMAK aynı gideri iki kez sayardı, sadece birini almak ise girilen
 * veriyi ya da düzenli gideri görmezden gelirdi.
 */
export function projectCashflow(input: CashflowInput): CashflowProjection {
  const { openingBalance, startMonth, monthCount, collectionRate } = input;
  const rate = Math.min(1, Math.max(0, collectionRate));

  const incomeByMonth = new Map<string, number>();
  for (const inst of input.openInstallments) {
    const key = monthKey(inst.dueDate);
    incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + inst.remaining);
  }

  // Ay → kategori → bilinen gider toplamı
  const knownByMonth = new Map<string, Map<string, number>>();
  for (const exp of input.pendingExpenses) {
    const key = monthKey(exp.dueDate);
    const byCategory = knownByMonth.get(key) ?? new Map<string, number>();
    byCategory.set(exp.categoryId, (byCategory.get(exp.categoryId) ?? 0) + exp.amount);
    knownByMonth.set(key, byCategory);
  }

  const paidThisMonth = new Map(input.alreadyPaidByCategory.map((r) => [r.categoryId, r.amount]));

  const months: CashflowMonth[] = [];
  let running = openingBalance;
  let firstNegativeMonth: string | null = null;
  let lowestClosing = openingBalance;

  for (let i = 0; i < monthCount; i += 1) {
    const cursor = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
    const key = monthKey(cursor);

    const plannedIncome = round2(incomeByMonth.get(key) ?? 0);
    const expectedIncome = round2(plannedIncome * rate);

    const known = knownByMonth.get(key) ?? new Map<string, number>();
    const knownExpense = round2([...known.values()].reduce((sum, v) => sum + v, 0));

    // Düzenli giderlerin, o ay girilmiş rakamı AŞAN kısmı. İlk ayda
    // ayrıca ÖDENMİŞ kısım da düşülür (açılış bakiyesinde zaten var).
    let estimatedExpense = 0;
    for (const recurring of input.recurringByCategory) {
      const alreadyKnown = known.get(recurring.categoryId) ?? 0;
      const alreadyPaid = i === 0 ? (paidThisMonth.get(recurring.categoryId) ?? 0) : 0;
      estimatedExpense += Math.max(0, recurring.monthlyAmount - alreadyKnown - alreadyPaid);
    }
    estimatedExpense = round2(estimatedExpense);

    const expectedExpense = round2(knownExpense + estimatedExpense);
    const opening = round2(running);
    const closing = round2(opening + expectedIncome - expectedExpense);
    running = closing;

    if (closing < 0 && firstNegativeMonth === null) firstNegativeMonth = key;
    if (closing < lowestClosing) lowestClosing = closing;

    months.push({
      key,
      label: monthLabel(cursor),
      opening,
      plannedIncome,
      expectedIncome,
      knownExpense,
      estimatedExpense,
      expectedExpense,
      closing,
      isNegative: closing < 0,
    });
  }

  return { months, firstNegativeMonth, lowestClosing: round2(lowestClosing) };
}

/**
 * Geçmiş tahsilat oranı: vadesi GEÇMİŞ taksitlerin ne kadarı tahsil
 * edilmiş? Ham "beklenen gelir" bir temenni listesidir; kurumun gerçek
 * tahsilat performansıyla çarpılmadan projeksiyon iyimser çıkar.
 *
 * Geçmiş veri yoksa 1 döner — veri yokluğunu "kimse ödemiyor" diye
 * yorumlayıp müdürü boş yere korkutmamak için.
 */
export function computeCollectionRate(due: number, collected: number): number {
  if (due <= 0) return 1;
  return Math.min(1, Math.max(0, collected / due));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
