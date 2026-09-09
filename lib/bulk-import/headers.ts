import { columnsFor, type ImportRole, type RawRow } from "./types";

// Yüklenen dosyanın BAŞLIK SATIRI kontrolü.
//
// Bu dosya, testte yaşanan somut bir kafa karışıklığından doğdu:
// "GSM" yerine "Cep Telefonu" başlıklı bir dosya yüklendiğinde sistem
// her satır için ayrı ayrı "GSM zorunludur." diyordu. Müdür kendi
// dosyasına bakıyor, her satırda bir telefon numarası görüyor ve
// sistemin bozuk olduğunu düşünüyor — çünkü mesaj "GSM"in bir SÜTUN
// ADI olduğunu söylemiyor.
//
// Sütunun hiç olmaması ile hücrenin boş olması FARKLI hatalardır:
//   • sütun yok  → DOSYA hatası, bir kez söylenir, satırlar denenmez
//   • hücre boş  → SATIR hatası, satır satır bildirilir
//
// Bu ayrımı yapmak, 100 satırlık aynı hatayı tek cümleye indirir.

export type HeaderCheck = {
  ok: boolean;
  /** Dosyada bulunamayan zorunlu sütunlar. */
  missing: string[];
  /** Dosyada olan ama sistemin tanımadığı sütunlar. */
  unknown: string[];
  /** Kullanıcıya gösterilecek tek cümlelik açıklama (ok ise boş). */
  message: string;
};

// İngilizce alan adları da kabul edilir (API'yi doğrudan kullananlar
// için); başlık kontrolünde ikisi de "var" sayılır.
const ALIASES: Record<string, string[]> = {
  "T.C. No": ["nationalId"],
  "Ad Soyad": ["fullName"],
  "Öğrenci GSM": ["phone"],
  Şube: ["branchName"],
  "Veli Ad Soyad": ["parentName"],
  "Veli GSM": ["parentPhone"],
  "SMS İzni": ["parentSmsConsent"],
  "Özel Not": ["healthNote"],
  Branş: ["subject"],
  GSM: ["mobilePhone"],
  "E-posta": ["email"],
  "Danışman Şube": ["advisorBranchName"],
  "Şube Adı": ["name"],
  "Sınıf Seviyesi": ["grade"],
  Segment: ["segment"],
  "Alan/Dal": ["track"],
};

// Boş bırakılabilen sütunlar — eksikse dosya reddedilmez.
const OPTIONAL: Record<ImportRole, string[]> = {
  STUDENT: ["SMS İzni", "Özel Not"],
  TEACHER: ["E-posta", "Danışman Şube"],
  BRANCH: ["Alan/Dal"],
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
}

export function checkHeaders(role: ImportRole, rows: RawRow[]): HeaderCheck {
  const ok: HeaderCheck = { ok: true, missing: [], unknown: [], message: "" };
  if (rows.length === 0) return ok;

  // Başlıklar ilk satırın anahtarlarından okunur; bazı satırlarda boş
  // hücreler atlanmış olabileceği için TÜM satırların anahtarları
  // birleştirilir.
  //
  // Karşılaştırma normalize edilmiş hâlle yapılır ama kullanıcıya
  // KENDİ YAZDIĞI başlık gösterilir: "cep telefonu" diye uyarmak,
  // dosyasında "Cep Telefonu" yazan müdür için bir tık daha zordur.
  const present = new Set<string>();
  const originalByNormalized = new Map<string, string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const n = normalize(key);
      present.add(n);
      if (!originalByNormalized.has(n)) originalByNormalized.set(n, key.trim());
    }
  }

  const expected = columnsFor(role);
  const optional = new Set(OPTIONAL[role].map(normalize));

  const missing = expected.filter((col) => {
    if (optional.has(normalize(col))) return false;
    if (present.has(normalize(col))) return false;
    return !(ALIASES[col] ?? []).some((a) => present.has(normalize(a)));
  });

  const known = new Set<string>();
  for (const col of expected) {
    known.add(normalize(col));
    for (const a of ALIASES[col] ?? []) known.add(normalize(a));
  }
  const unknown = [...present].filter((p) => !known.has(p)).map((p) => originalByNormalized.get(p) ?? p);

  if (missing.length === 0) return { ...ok, unknown };

  // Mesaj, eksik sütunu ve BEKLENEN TÜM sütunları birlikte verir:
  // müdürün dosyasını düzeltmek için başka yere bakması gerekmesin.
  const missingText = missing.map((m) => `"${m}"`).join(", ");
  const unknownText =
    unknown.length > 0 ? ` Dosyadaki tanınmayan sütunlar: ${unknown.map((u) => `"${u}"`).join(", ")}.` : "";

  return {
    ok: false,
    missing,
    unknown,
    message:
      `Dosyada ${missingText} sütunu bulunamadı — sütun BAŞLIKLARI birebir eşleşmeli.${unknownText}` +
      ` Beklenen başlıklar: ${expected.join(", ")}. Şablonu indirip kullanmanız en güvenlisi.`,
  };
}
