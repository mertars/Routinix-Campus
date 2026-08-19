// SCHEDULE_DAYS/SCHEDULE_SLOTS haftalık, tekrar eden bir şablondur — gerçek
// bir takvim tarihi değil (bkz. lib/mock-data.ts). "Bugün" bu yüzden haftanın
// GÜN ADINA karşılık gelir, sunucu tarafında da aynı mantıkla hesaplanır.
const JS_DAY_TO_TR: Record<number, string | null> = {
  0: null,
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: null,
};

export function getTodayTrDayName(): string | null {
  return JS_DAY_TO_TR[new Date().getDay()];
}

export function parseSlotRange(slot: string): [number, number] {
  const [start, end] = slot.split("-");
  const toMinutes = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };
  return [toMinutes(start), toMinutes(end)];
}

export function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}
