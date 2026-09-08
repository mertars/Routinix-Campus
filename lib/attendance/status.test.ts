import { describe, it, expect } from "vitest";
import { computeAttendanceRate, isValidAttendanceStatus } from "./status";

describe("computeAttendanceRate", () => {
  it("geldi ve geç olumlu sayılır", () => {
    expect(computeAttendanceRate([{ status: "PRESENT" }, { status: "LATE" }])).toBe(100);
  });

  it("yok oranı düşürür", () => {
    expect(computeAttendanceRate([{ status: "PRESENT" }, { status: "ABSENT" }])).toBe(50);
  });

  // Kuralın kalbi: mazeretli öğrenci ne ödüllendirilir ne cezalandırılır.
  it("izinli PAYDADAN DÜŞER — mazeretli öğrenci cezalandırılmaz", () => {
    // 8 geldi + 2 izinli → %100 (2 izinli hiç sayılmaz)
    const records = [...Array(8).fill({ status: "PRESENT" }), ...Array(2).fill({ status: "EXCUSED" })];
    expect(computeAttendanceRate(records)).toBe(100);
  });

  it("izinli oranı ŞİŞİRMEZ de", () => {
    // 1 geldi + 1 yok + 2 izinli → sayılan 2 ders, biri olumlu → %50
    expect(
      computeAttendanceRate([{ status: "PRESENT" }, { status: "ABSENT" }, { status: "EXCUSED" }, { status: "EXCUSED" }])
    ).toBe(50);
  });

  it("hepsi izinliyse oran %100 kalır (bölme hatası yok)", () => {
    expect(computeAttendanceRate([{ status: "EXCUSED" }, { status: "EXCUSED" }])).toBe(100);
  });

  it("kayıt yoksa %100", () => {
    expect(computeAttendanceRate([])).toBe(100);
  });
});

describe("isValidAttendanceStatus", () => {
  it("dört durumu kabul eder", () => {
    for (const s of ["PRESENT", "LATE", "EXCUSED", "ABSENT"]) expect(isValidAttendanceStatus(s)).toBe(true);
  });

  it("tanınmayanı reddeder", () => {
    expect(isValidAttendanceStatus("IZINLI")).toBe(false);
    expect(isValidAttendanceStatus(null)).toBe(false);
  });
});
