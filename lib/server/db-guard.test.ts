import { describe, expect, it } from "vitest";
import { assertScopedBulkWrite, UnscopedBulkWriteError } from "./db-guard";

// Saf args kontrolü — veritabanı bağlantısı GEREKMEZ.
function runDelete(model: string, where: unknown) {
  assertScopedBulkWrite(model, "deleteMany", where);
  return "ÇALIŞTI";
}
function runUpdate(model: string, where: unknown) {
  assertScopedBulkWrite(model, "updateMany", where);
  return "ÇALIŞTI";
}

describe("bulkWriteGuard", () => {
  it("2026-09-14'teki GERÇEK hatayı reddeder: (date, slot) ile yoklama silme", () => {
    expect(() =>
      runDelete("AttendanceRecord", { date: new Date("2026-09-14"), slot: "16:00-17:00" })
    ).toThrow(UnscopedBulkWriteError);
  });

  it("where hiç verilmezse reddeder", () => {
    expect(() => runDelete("ActivityNotification", undefined)).toThrow(UnscopedBulkWriteError);
    expect(() => runDelete("Payment", {})).toThrow(UnscopedBulkWriteError);
  });

  it("içerik alanlarıyla (weekLabel) silmeyi reddeder — 2026-09-12'deki hata", () => {
    expect(() => runDelete("YearlyPlanRow", { weekLabel: { in: ["1. Hafta", "2. Hafta"] } })).toThrow(UnscopedBulkWriteError);
  });

  it("id listesiyle silmeye İZİN VERİR (doğru temizlik yöntemi)", () => {
    expect(() => runDelete("AttendanceRecord", { id: { in: ["a", "b"] } })).not.toThrow();
  });

  it("sahiplik anahtarlarıyla daraltılmış mevcut çağrılara İZİN VERİR", () => {
    // Gerçek kod tabanındaki örnekler:
    expect(() => runDelete("AppointmentRequest", { studentId: "s1" })).not.toThrow();
    expect(() => runDelete("AttendanceRecord", { branchId: "b1", date: new Date() })).not.toThrow();
    expect(() => runUpdate("Installment", { institutionId: "i1", status: "PENDING" })).not.toThrow();
    expect(() => runUpdate("ActivityNotification", { recipientId: "r1", isRead: false })).not.toThrow();
  });

  it("ilişki üzerinden daraltmayı kabul eder", () => {
    expect(() => runDelete("Question", { student: { institutionId: "i1" } })).not.toThrow();
  });

  it("korunmayan (yapılandırma) modellerine karışmaz", () => {
    expect(() => runDelete("ExamCategory", { name: "TYT" })).not.toThrow();
  });

  it("OR'da dallardan biri daraltılmamışsa reddeder", () => {
    expect(() =>
      runDelete("Payment", { OR: [{ studentId: "s1" }, { status: "COMPLETED" }] })
    ).toThrow(UnscopedBulkWriteError);
    expect(() =>
      runDelete("Payment", { OR: [{ studentId: "s1" }, { studentId: "s2" }] })
    ).not.toThrow();
  });
});
