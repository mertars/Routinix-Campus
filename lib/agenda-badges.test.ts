import { describe, it, expect } from "vitest";
import { toBadges } from "./agenda-badges";
import type { AgendaItem } from "./agenda-types";

function task(overrides: Partial<AgendaItem>): AgendaItem {
  return { key: "k", horizon: "today", area: "finance", title: "", detail: "", count: 1, urgency: "info", ...overrides };
}

describe("toBadges", () => {
  it("veri yoksa rozet üretmez", () => {
    expect(toBadges(null)).toEqual({});
    expect(toBadges([])).toEqual({});
  });

  it("sekmesi olmayan işi (ödeme modülüne giden href) menüye yazmaz", () => {
    expect(toBadges([task({ key: "overdue", count: 4, href: "/payments/principal" })])).toEqual({});
  });

  it("sayısı sıfır olan işi rozete dönüştürmez — boş rozet gürültüdür", () => {
    expect(toBadges([task({ tab: "attendance", count: 0, urgency: "critical" })])).toEqual({});
  });

  it("sekme başına sayıyı ve aciliyeti taşır", () => {
    expect(toBadges([task({ tab: "attendance", count: 5, urgency: "critical" })])).toEqual({
      attendance: { count: 5, urgency: "critical" },
    });
  });

  it("aynı sekmeye düşen işleri toplar, EN ACİL rengi kazandırır", () => {
    const badges = toBadges([
      task({ key: "a", tab: "attendance", count: 3, urgency: "info" }),
      task({ key: "b", tab: "attendance", count: 2, urgency: "critical" }),
      task({ key: "c", tab: "attendance", count: 1, urgency: "attention" }),
    ]);
    expect(badges.attendance).toEqual({ count: 6, urgency: "critical" });
  });

  it("aciliyet sırası işlerin geliş sırasından bağımsızdır", () => {
    const artan = toBadges([
      task({ key: "a", tab: "x", count: 1, urgency: "info" }),
      task({ key: "b", tab: "x", count: 1, urgency: "attention" }),
    ]);
    const azalan = toBadges([
      task({ key: "b", tab: "x", count: 1, urgency: "attention" }),
      task({ key: "a", tab: "x", count: 1, urgency: "info" }),
    ]);
    expect(artan).toEqual(azalan);
    expect(artan.x.urgency).toBe("attention");
  });
});
