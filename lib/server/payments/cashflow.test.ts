import { describe, it, expect } from "vitest";
import { projectCashflow, computeCollectionRate, monthKey } from "./cashflow";

const START = new Date(2026, 8, 1); // Eylül 2026

function baseInput(overrides: Partial<Parameters<typeof projectCashflow>[0]> = {}) {
  return {
    openingBalance: 0,
    startMonth: START,
    monthCount: 3,
    collectionRate: 1,
    openInstallments: [],
    pendingExpenses: [],
    recurringByCategory: [],
    alreadyPaidByCategory: [],
    ...overrides,
  };
}

describe("computeCollectionRate", () => {
  it("tahsil edilen / vadesi gelen oranını verir", () => {
    expect(computeCollectionRate(1000, 750)).toBe(0.75);
  });

  it("geçmiş veri yoksa 1 döner — veri yokluğu 'kimse ödemiyor' demek değildir", () => {
    expect(computeCollectionRate(0, 0)).toBe(1);
  });

  it("fazla tahsilatta 1'i aşmaz", () => {
    expect(computeCollectionRate(1000, 1400)).toBe(1);
  });
});

describe("projectCashflow", () => {
  it("beklenen geliri tahsilat oranıyla düzeltir", () => {
    const { months } = projectCashflow(
      baseInput({
        monthCount: 1,
        collectionRate: 0.8,
        openInstallments: [{ dueDate: new Date(2026, 8, 15), remaining: 10_000 }],
      })
    );
    expect(months[0].plannedIncome).toBe(10_000);
    expect(months[0].expectedIncome).toBe(8_000);
  });

  it("bakiyeyi aydan aya devreder", () => {
    const { months } = projectCashflow(
      baseInput({
        openingBalance: 5_000,
        monthCount: 2,
        openInstallments: [
          { dueDate: new Date(2026, 8, 10), remaining: 3_000 },
          { dueDate: new Date(2026, 9, 10), remaining: 2_000 },
        ],
      })
    );
    expect(months[0].closing).toBe(8_000);
    expect(months[1].opening).toBe(8_000);
    expect(months[1].closing).toBe(10_000);
  });

  // Kuralın kalbi: girilmiş gider ile düzenli tahmin TOPLANMAZ.
  it("girilmiş gider düzenli tahminden büyükse tahmini yok sayar", () => {
    const { months } = projectCashflow(
      baseInput({
        monthCount: 1,
        pendingExpenses: [{ dueDate: new Date(2026, 8, 20), amount: 12_000, categoryId: "kira" }],
        recurringByCategory: [{ categoryId: "kira", categoryName: "Kira", monthlyAmount: 10_000 }],
      })
    );
    expect(months[0].knownExpense).toBe(12_000);
    expect(months[0].estimatedExpense).toBe(0);
    expect(months[0].expectedExpense).toBe(12_000);
  });

  it("girilmiş gider düzenli tahminden küçükse yalnızca farkı ekler", () => {
    const { months } = projectCashflow(
      baseInput({
        monthCount: 1,
        pendingExpenses: [{ dueDate: new Date(2026, 8, 20), amount: 4_000, categoryId: "kira" }],
        recurringByCategory: [{ categoryId: "kira", categoryName: "Kira", monthlyAmount: 10_000 }],
      })
    );
    expect(months[0].knownExpense).toBe(4_000);
    expect(months[0].estimatedExpense).toBe(6_000);
    expect(months[0].expectedExpense).toBe(10_000);
  });

  it("gider girilmemiş aylarda düzenli tahmini tam uygular", () => {
    const { months } = projectCashflow(
      baseInput({
        monthCount: 2,
        pendingExpenses: [{ dueDate: new Date(2026, 8, 20), amount: 10_000, categoryId: "kira" }],
        recurringByCategory: [{ categoryId: "kira", categoryName: "Kira", monthlyAmount: 10_000 }],
      })
    );
    expect(months[0].expectedExpense).toBe(10_000);
    expect(months[1].knownExpense).toBe(0);
    expect(months[1].expectedExpense).toBe(10_000);
  });

  it("kategoriler birbirini etkilemez", () => {
    const { months } = projectCashflow(
      baseInput({
        monthCount: 1,
        pendingExpenses: [{ dueDate: new Date(2026, 8, 5), amount: 20_000, categoryId: "kira" }],
        recurringByCategory: [
          { categoryId: "kira", categoryName: "Kira", monthlyAmount: 10_000 },
          { categoryId: "elektrik", categoryName: "Elektrik", monthlyAmount: 3_000 },
        ],
      })
    );
    // Kirada fazla girilmiş olması elektriğin tahminini bastırmamalı
    expect(months[0].expectedExpense).toBe(23_000);
  });

  // Açılış bakiyesi bu ay ödenmiş giderleri ZATEN içerir; tahmin ilk aya
  // tam uygulanırsa aynı kira iki kez düşülür.
  it("bu ay ödenmiş gideri yalnızca İLK ayın tahmininden düşer", () => {
    const { months } = projectCashflow(
      baseInput({
        monthCount: 2,
        recurringByCategory: [{ categoryId: "kira", categoryName: "Kira", monthlyAmount: 10_000 }],
        alreadyPaidByCategory: [{ categoryId: "kira", amount: 10_000 }],
      })
    );
    expect(months[0].expectedExpense).toBe(0);
    expect(months[1].expectedExpense).toBe(10_000);
  });

  it("kısmen ödenmiş gideri kalan kadar tahmin eder", () => {
    const { months } = projectCashflow(
      baseInput({
        monthCount: 1,
        recurringByCategory: [{ categoryId: "kira", categoryName: "Kira", monthlyAmount: 10_000 }],
        alreadyPaidByCategory: [{ categoryId: "kira", amount: 4_000 }],
      })
    );
    expect(months[0].expectedExpense).toBe(6_000);
  });

  it("ödenmiş tutar beklentiyi aşarsa negatif gider üretmez", () => {
    const { months } = projectCashflow(
      baseInput({
        monthCount: 1,
        recurringByCategory: [{ categoryId: "kira", categoryName: "Kira", monthlyAmount: 10_000 }],
        alreadyPaidByCategory: [{ categoryId: "kira", amount: 25_000 }],
      })
    );
    expect(months[0].expectedExpense).toBe(0);
  });

  it("ödenmiş ve girilmiş gider birlikte düşülür", () => {
    const { months } = projectCashflow(
      baseInput({
        monthCount: 1,
        pendingExpenses: [{ dueDate: new Date(2026, 8, 25), amount: 3_000, categoryId: "kira" }],
        recurringByCategory: [{ categoryId: "kira", categoryName: "Kira", monthlyAmount: 10_000 }],
        alreadyPaidByCategory: [{ categoryId: "kira", amount: 5_000 }],
      })
    );
    // 3.000 girilmiş nakit çıkışı olarak kalır; tahmin 10.000−3.000−5.000
    expect(months[0].knownExpense).toBe(3_000);
    expect(months[0].estimatedExpense).toBe(2_000);
    expect(months[0].expectedExpense).toBe(5_000);
  });

  it("nakit sıkıntısına düşülen İLK ayı bildirir", () => {
    const { months, firstNegativeMonth, lowestClosing } = projectCashflow(
      baseInput({
        openingBalance: 10_000,
        monthCount: 3,
        recurringByCategory: [{ categoryId: "kira", categoryName: "Kira", monthlyAmount: 6_000 }],
      })
    );
    expect(months.map((m) => m.closing)).toEqual([4_000, -2_000, -8_000]);
    expect(firstNegativeMonth).toBe("2026-10");
    expect(lowestClosing).toBe(-8_000);
  });

  it("hiç eksiye düşmüyorsa uyarı üretmez", () => {
    const { firstNegativeMonth } = projectCashflow(baseInput({ openingBalance: 100_000, monthCount: 3 }));
    expect(firstNegativeMonth).toBeNull();
  });

  it("yıl sınırını doğru aşar", () => {
    const { months } = projectCashflow(baseInput({ startMonth: new Date(2026, 10, 1), monthCount: 3 }));
    expect(months.map((m) => m.key)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(months[2].label).toBe("Ocak 2027");
  });

  it("projeksiyon aralığı dışındaki taksit hiçbir aya yazılmaz", () => {
    const { months } = projectCashflow(
      baseInput({
        monthCount: 2,
        openInstallments: [{ dueDate: new Date(2027, 5, 1), remaining: 50_000 }],
      })
    );
    expect(months.every((m) => m.plannedIncome === 0)).toBe(true);
  });
});

describe("monthKey", () => {
  it("ayı sıfır dolgulu verir", () => {
    expect(monthKey(new Date(2026, 0, 31))).toBe("2026-01");
    expect(monthKey(new Date(2026, 11, 1))).toBe("2026-12");
  });
});
