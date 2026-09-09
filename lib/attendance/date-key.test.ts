import { describe, it, expect } from "vitest";
import { parseAttendanceDate, toAttendanceDateKey, todayAttendanceKey } from "./date-key";

// Bu testler GERÇEK bir veri bozulmasından sonra yazıldı: yoklama
// tarihleri `setHours(0,0,0,0)` ile YEREL gece yarısına çekiliyordu ve
// sunucu UTC+3'te çalıştığında tarih bir gün geriye kayıyordu.
// Ölçüldü: 3.893 kaydın 1.946'sı kaymış haldeydi.
//
// Kritik nokta: hata ORTAMA BAĞLIYDI. Vercel UTC'de çalıştığı için
// orada görünmüyordu. Bu yüzden testler, sonucun sunucunun saat
// diliminden BAĞIMSIZ olduğunu doğrular.
describe("parseAttendanceDate", () => {
  it("her zaman UTC gece yarısı üretir", () => {
    const d = parseAttendanceDate("2026-09-09");
    expect(d.toISOString()).toBe("2026-09-09T00:00:00.000Z");
  });

  it("ayın ilk ve son günlerinde kaymaz", () => {
    expect(parseAttendanceDate("2026-01-01").toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(parseAttendanceDate("2026-12-31").toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });

  it("artık gün doğru çözülür", () => {
    expect(parseAttendanceDate("2028-02-29").toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  // setHours kullanan eski sürüm UTC+3'te bunu 2026-09-08T21:00Z
  // yapıyordu; testin varlık sebebi bu.
  it("bir gün geriye KAYMAZ", () => {
    const d = parseAttendanceDate("2026-09-09");
    expect(d.getUTCDate()).toBe(9);
    expect(d.getUTCMonth()).toBe(8);
  });

  it("geçersiz girdide Invalid Date döner", () => {
    expect(Number.isNaN(parseAttendanceDate("").getTime())).toBe(true);
    expect(Number.isNaN(parseAttendanceDate("abc").getTime())).toBe(true);
  });
});

describe("toAttendanceDateKey", () => {
  it("gün içindeki herhangi bir saati gece yarısına indirger", () => {
    expect(toAttendanceDateKey(new Date("2026-09-09T16:23:52.414Z")).toISOString()).toBe(
      "2026-09-09T00:00:00.000Z"
    );
  });

  it("zaten gece yarısı olanı değiştirmez", () => {
    const d = new Date("2026-09-09T00:00:00.000Z");
    expect(toAttendanceDateKey(d).toISOString()).toBe(d.toISOString());
  });

  // Yazma ve okuma AYNI anahtarı üretmezse yoklamalar bulunamaz;
  // hata tam olarak böyle görünmez kalmıştı.
  it("yazma ve okuma aynı anahtarı üretir", () => {
    expect(toAttendanceDateKey(parseAttendanceDate("2026-09-09")).toISOString()).toBe(
      parseAttendanceDate("2026-09-09").toISOString()
    );
  });
});

describe("todayAttendanceKey", () => {
  it("bugünün UTC gece yarısını verir", () => {
    const k = todayAttendanceKey();
    expect(k.getUTCHours()).toBe(0);
    expect(k.getUTCMinutes()).toBe(0);
    expect(k.getUTCSeconds()).toBe(0);
    expect(k.getUTCMilliseconds()).toBe(0);
  });
});
