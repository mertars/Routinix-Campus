import { describe, it, expect } from "vitest";
import { trStartOfDay, trEndOfDay, trEndOfDayIn, trMonthKey, trDayOfMonth } from "./tr-time";

describe("tr-time", () => {
  it("Türkiye'de gün 21:00Z'de başlar (UTC+3), sunucu saatinden bağımsız", () => {
    // 10 Eylül 2026 01:00 TR = 9 Eylül 22:00 UTC → gün başı 9 Eylül 21:00Z
    expect(trStartOfDay(new Date("2026-09-09T22:00:00Z")).toISOString()).toBe("2026-09-09T21:00:00.000Z");
  });

  it("UTC'de gün dönmüşken TR'de dönmemişse hâlâ dünün gündemini verir", () => {
    // 9 Eylül 23:00 UTC = 10 Eylül 02:00 TR → TR günü 10 Eylül
    expect(trStartOfDay(new Date("2026-09-09T23:00:00Z")).toISOString()).toBe("2026-09-09T21:00:00.000Z");
    // 9 Eylül 20:00 UTC = 9 Eylül 23:00 TR → TR günü hâlâ 9 Eylül
    expect(trStartOfDay(new Date("2026-09-09T20:00:00Z")).toISOString()).toBe("2026-09-08T21:00:00.000Z");
  });

  it("gün bitişi ertesi günün başlangıcıdır", () => {
    const at = new Date("2026-09-09T10:00:00Z");
    expect(trEndOfDay(at).getTime() - trStartOfDay(at).getTime()).toBe(86_400_000);
  });

  it("n gün sonrası tam n gün ekler", () => {
    const at = new Date("2026-09-09T10:00:00Z");
    expect(trEndOfDayIn(at, 7).getTime() - trEndOfDay(at).getTime()).toBe(7 * 86_400_000);
    expect(trEndOfDayIn(at, 0).getTime()).toBe(trEndOfDay(at).getTime());
  });

  it("ay anahtarı ve ayın günü TR takvimine göre", () => {
    // 30 Eylül 22:00 UTC = 1 Ekim 01:00 TR
    expect(trMonthKey(new Date("2026-09-30T22:00:00Z"))).toBe("2026-10");
    expect(trDayOfMonth(new Date("2026-09-30T22:00:00Z"))).toBe(1);
    expect(trMonthKey(new Date("2026-09-30T18:00:00Z"))).toBe("2026-09");
  });
});
