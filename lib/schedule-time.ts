// SCHEDULE_DAYS haftalık, tekrar eden bir şablondur — gerçek bir takvim
// tarihi değil. "Bugün" bu yüzden haftanın GÜN ADINA karşılık gelir.
// Client (öğretmen/öğrenci "şu an hangi ders" widget'ları) VE server
// (canlı etüt vb.) tarafından paylaşılır — bu yüzden BİLEREK "server/"
// önekiyle DEĞİL, isomorphic bir konumda tutulur (bkz. lib/seating/types.ts'teki
// aynı gerekçe: "use client" bir dosyadan "server/" önekli bir modül import
// etmek, o modülün ileride sunucuya özgü bir bağımlılık kazanmasını
// sessizce imkansız hale getirir).
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

// slot her zaman "HH:MM-HH:MM" formatında olmalı (bkz.
// ScheduleSlotDefinition şemasındaki not) — dinamik saat dilimi
// listesinde admin serbestçe SAAT seçebilir ama format sabit kalır,
// aksi halde bu fonksiyon (ve ona bağlı "şu an hangi ders" mantığı) bozulur.
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
