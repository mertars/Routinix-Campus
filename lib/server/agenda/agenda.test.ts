import { describe, it, expect, vi } from "vitest";
import { getAgenda, buildAgendaContext } from "./agenda";
import type { AgendaHit, AgendaSource } from "./agenda-types";

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

function source(key: string, hit: AgendaHit | null, extra: Partial<AgendaSource> = {}): AgendaSource {
  return {
    key,
    horizon: "today",
    area: "finance",
    urgency: "info",
    load: async () => hit,
    ...extra,
  };
}

const hit = (count: number): AgendaHit => ({ count, title: `${count} iş`, detail: "" });

describe("getAgenda", () => {
  it("sayısı sıfır ya da bulgusu olmayan kaynak panele hiç girmez", async () => {
    const agenda = await getAgenda("inst", new Date(), [
      source("bos", null),
      source("sifir", hit(0)),
      source("var", hit(3)),
    ]);
    expect(agenda.items.map((i) => i.key)).toEqual(["var"]);
    expect(agenda.allClear).toBe(false);
  });

  it("hiç iş yoksa allClear", async () => {
    const agenda = await getAgenda("inst", new Date(), [source("bos", null)]);
    expect(agenda.allClear).toBe(true);
    expect(agenda.counts.critical).toBe(0);
  });

  it("PATLAYAN kaynak diğerlerini düşürmez — gündem yine gelir", async () => {
    const patlayan = source("patlak", null);
    patlayan.load = async () => {
      throw new Error("sorgu bozuk");
    };
    const agenda = await getAgenda("inst", new Date(), [patlayan, source("saglam", hit(2))]);
    expect(agenda.items.map((i) => i.key)).toEqual(["saglam"]);
  });

  it("önce aciliyete, eşitlikte SAYIYA göre sıralar", async () => {
    const agenda = await getAgenda("inst", new Date(), [
      source("bilgi", hit(99), { urgency: "info" }),
      source("az-acil", hit(1), { urgency: "critical" }),
      source("dikkat", hit(5), { urgency: "attention" }),
      source("cok-acil", hit(7), { urgency: "critical" }),
    ]);
    expect(agenda.items.map((i) => i.key)).toEqual(["cok-acil", "az-acil", "dikkat", "bilgi"]);
  });

  it("kaynak aciliyeti yükseltebilir (bulduğu duruma göre)", async () => {
    const agenda = await getAgenda("inst", new Date(), [
      source("sozlesme", { count: 1, title: "", detail: "", urgency: "critical" }, { urgency: "attention" }),
    ]);
    expect(agenda.items[0].urgency).toBe("critical");
  });

  it("sayımlar her ufuk için ayrı tutulur — eksikler işlere karışmaz", async () => {
    const agenda = await getAgenda("inst", new Date(), [
      source("a", hit(1), { horizon: "today", urgency: "critical" }),
      source("b", hit(1), { horizon: "week" }),
      source("c", hit(1), { horizon: "gaps" }),
      source("d", hit(1), { horizon: "gaps" }),
    ]);
    expect(agenda.counts).toEqual({ today: 1, week: 1, month: 0, gaps: 2, critical: 1 });
  });

  it("hedefi (sekme / adres) maddeye taşır", async () => {
    const agenda = await getAgenda("inst", new Date(), [
      source("sekme", hit(1), { tab: "attendance" }),
      source("adres", hit(1), { href: "/payments/principal?tab=students" }),
    ]);
    expect(agenda.items.find((i) => i.key === "sekme")?.tab).toBe("attendance");
    expect(agenda.items.find((i) => i.key === "adres")?.href).toBe("/payments/principal?tab=students");
  });
});

describe("buildAgendaContext", () => {
  it("hafta penceresi bugün dahil 7 gündür", () => {
    const ctx = buildAgendaContext("inst", new Date("2026-09-10T09:00:00Z"));
    expect(ctx.weekEnd.getTime() - ctx.todayEnd.getTime()).toBe(6 * 86_400_000);
  });

  it("ay anahtarı Türkiye takviminden gelir", () => {
    expect(buildAgendaContext("inst", new Date("2026-09-30T22:00:00Z")).monthKey).toBe("2026-10");
  });
});
