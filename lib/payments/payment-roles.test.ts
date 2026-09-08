import { describe, it, expect } from "vitest";
import { canAccessTab, COLLECTOR_TABS } from "./payment-roles";

const ALL_TABS = [
  "dashboard",
  "students",
  "expenses",
  "accounts",
  "products",
  "payroll",
  "contracts",
  "budget",
  "reports",
];

describe("canAccessTab", () => {
  it("NONE hiçbir sekmeye giremez", () => {
    expect(ALL_TABS.some((t) => canAccessTab("NONE", t))).toBe(false);
  });

  it("FULL her sekmeye girebilir", () => {
    expect(ALL_TABS.every((t) => canAccessTab("FULL", t))).toBe(true);
  });

  it("COLLECTOR yalnızca tahsilat sekmelerine girebilir", () => {
    const allowed = ALL_TABS.filter((t) => canAccessTab("COLLECTOR", t));
    expect(allowed).toEqual(["dashboard", "students"]);
  });

  // Liste "yapabilir" üzerinden kurulu olduğu için yeni bir sekme
  // eklendiğinde tahsildara KAPALI gelmeli — bu test o kuralı sabitler.
  it("tanınmayan yeni bir sekme COLLECTOR'a varsayılan olarak kapalıdır", () => {
    expect(canAccessTab("COLLECTOR", "yeni-sekme")).toBe(false);
    expect(canAccessTab("FULL", "yeni-sekme")).toBe(true);
  });

  it("para çıkaran sekmelerin hiçbiri tahsildar listesinde değildir", () => {
    for (const tab of ["expenses", "payroll", "accounts", "budget", "contracts"]) {
      expect(COLLECTOR_TABS as readonly string[]).not.toContain(tab);
    }
  });
});
